package app.mlyfo.keyboard

import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.inputmethodservice.InputMethodService
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject

/**
 * The Mlyfo keyboard (Android preview).
 *
 * It types like any keyboard. While you type it reads only the line you are on, and it looks
 * at what you copy. When that is about money (a split, a payment, a wallet address or a link),
 * a Mlyfo card appears above the keys and does the whole job there: Shield checks the address,
 * the payment goes out with a few seconds to undo, split links drop into the chat. Mlyfo is only
 * contacted when you tap the card, and never in password fields.
 */
class MlyfoKeyboard : InputMethodService() {

    private val night = Color.parseColor("#0B0C12")
    private val keyBg = Color.parseColor("#1F2230")
    private val keyFn = Color.parseColor("#2C2F3E")
    private val keyDown = Color.parseColor("#3A3E52")
    private val ink = Color.parseColor("#F1F2F8")
    private val slate = Color.parseColor("#A3A9BE")
    private val cobalt = Color.parseColor("#4B5BFF")

    private enum class Tone(val stroke: String, val chipBg: String, val chipInk: String) {
        NEUTRAL("#4B5BFF", "#26306B", "#9DA7FF"),
        OK("#2FBF8A", "#12392D", "#7FE3BC"),
        WARN("#F5B54A", "#3D2E12", "#F8CF83"),
        BLOCK("#FF6B95", "#3D1424", "#FFB3C8"),
    }

    /** IDLE follows what you type; the others belong to an action you started from the card. */
    private enum class Phase { IDLE, BUSY, COUNTING, DONE }

    private lateinit var strip: LinearLayout
    private lateinit var hint: TextView
    private lateinit var card: LinearLayout
    private lateinit var cardChip: TextView
    private lateinit var cardTitle: TextView
    private lateinit var cardSub: TextView
    private lateinit var cardButton: TextView
    private lateinit var cardButton2: TextView
    private lateinit var keys: LinearLayout

    private var shift = false
    private var symbols = false
    private var secret = false
    private var phase = Phase.IDLE
    private var shown: Pair<Found, String>? = null
    private var dismissed: String? = null
    private var copied: String? = null

    private val handler = Handler(Looper.getMainLooper())
    private var countdown: Runnable? = null
    private val clipboard by lazy { getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager }
    private val onCopy = ClipboardManager.OnPrimaryClipChangedListener { readClipboard(); refresh() }

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

    private fun rounded(color: Int, radiusDp: Float, stroke: Int? = null) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radiusDp).toFloat()
        if (stroke != null) setStroke(dp(1.5f), stroke)
    }

    override fun onCreate() {
        super.onCreate()
        clipboard.addPrimaryClipChangedListener(onCopy)
    }

    override fun onDestroy() {
        clipboard.removePrimaryClipChangedListener(onCopy)
        countdown?.let { handler.removeCallbacks(it) }
        super.onDestroy()
    }

    // ---- Layout ----------------------------------------------------------------------

    override fun onCreateInputView(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(night)
            setPadding(dp(6f), dp(6f), dp(6f), dp(8f))
        }

        strip = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8f), 0, dp(8f), 0)
        }
        strip.addView(View(this).apply { background = rounded(cobalt, 6f) }, LinearLayout.LayoutParams(dp(12f), dp(12f)))
        strip.addView(label("mlyfo", 14f, ink, bold = true).apply { setPadding(dp(8f), 0, 0, 0) })
        hint = label("Try “split 236 / 4” or copy an address", 12f, slate).apply {
            gravity = Gravity.END
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }
        strip.addView(hint, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        root.addView(strip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(38f)))

        card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14f), dp(12f), dp(14f), dp(12f))
            visibility = View.GONE
        }
        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        cardChip = label("", 12f, ink, bold = true).apply { setPadding(dp(8f), dp(3f), dp(8f), dp(3f)) }
        top.addView(cardChip)
        top.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        top.addView(label("✕", 15f, slate).apply {
            setPadding(dp(10f), dp(2f), dp(4f), dp(2f))
            setOnClickListener { close() }
        })
        card.addView(top)
        cardTitle = label("", 19f, ink, bold = true).apply { setPadding(0, dp(8f), 0, 0); maxLines = 2; ellipsize = TextUtils.TruncateAt.END }
        card.addView(cardTitle)
        cardSub = label("", 13f, slate).apply { setPadding(0, dp(2f), 0, dp(10f)); maxLines = 3; ellipsize = TextUtils.TruncateAt.END }
        card.addView(cardSub)
        val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        cardButton = label("", 14f, Color.parseColor("#0B0C12"), bold = true).apply {
            background = rounded(Color.WHITE, 10f)
            setPadding(dp(14f), dp(9f), dp(14f), dp(9f))
        }
        cardButton2 = label("", 14f, ink, bold = true).apply {
            background = rounded(Color.parseColor("#1F2230"), 10f, Color.parseColor("#3A3E52"))
            setPadding(dp(14f), dp(9f), dp(14f), dp(9f))
        }
        buttons.addView(cardButton)
        buttons.addView(cardButton2, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginStart = dp(8f) })
        card.addView(buttons)
        root.addView(card, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            setMargins(dp(2f), 0, dp(2f), dp(8f))
        })

        keys = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(keys)
        renderKeys()
        return root
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        symbols = false
        secret = isPassword(info)
        shift = capsHere()
        renderKeys()
        if (::hint.isInitialized) hint.text = if (secret) "Password field: Mlyfo isn’t reading it" else "Try “split 236 / 4” or copy an address"
        readClipboard()
        // A payment confirmed on the password screen comes back here once, ready to share.
        val receipt = if (info?.packageName != packageName && phase == Phase.IDLE) Api.takeReceipt(this) else null
        if (receipt != null) showPaid(receipt.first, receipt.second, null) else refresh()
    }

    override fun onUpdateSelection(oldSelStart: Int, oldSelEnd: Int, newSelStart: Int, newSelEnd: Int, candidatesStart: Int, candidatesEnd: Int) {
        super.onUpdateSelection(oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd)
        if (capsHere() && !shift && !symbols) { shift = true; renderKeys() }
        refresh()
    }

    private fun isPassword(info: EditorInfo?): Boolean {
        val t = info?.inputType ?: return false
        val v = t and InputType.TYPE_MASK_VARIATION
        val cls = t and InputType.TYPE_MASK_CLASS
        return (cls == InputType.TYPE_CLASS_TEXT && (v == InputType.TYPE_TEXT_VARIATION_PASSWORD || v == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD || v == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD)) ||
            (cls == InputType.TYPE_CLASS_NUMBER && v == InputType.TYPE_NUMBER_VARIATION_PASSWORD)
    }

    /** True when the field wants a capital letter here, such as at the start of a sentence. */
    private fun capsHere(): Boolean {
        val info = currentInputEditorInfo ?: return false
        val ic = currentInputConnection ?: return false
        return info.inputType != 0 && ic.getCursorCapsMode(info.inputType) != 0
    }

    // ---- What to show ----------------------------------------------------------------

    private fun readClipboard() {
        copied = try {
            clipboard.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(this)?.toString()?.take(280)
        } catch (e: SecurityException) {
            null
        }
    }

    private fun currentLine(): String =
        currentInputConnection?.getTextBeforeCursor(280, 0)?.toString().orEmpty().substringAfterLast('\n').trim()

    /** Mlyfo's own links (receipts, split links) are never something to scan. */
    private fun relevant(text: String): Found? {
        val f = parseIntent(text) ?: return null
        if (f is Found.Link && Uri.parse(f.url).host == Api.HOST) return null
        return f
    }

    /** The line being typed wins; otherwise what was just copied. Only while no card action is running. */
    private fun refresh() {
        if (!::card.isInitialized || phase != Phase.IDLE) return
        if (secret) { hide(); return }
        val line = currentLine()
        val next = relevant(line)?.let { it to line } ?: copied?.let { c -> relevant(c)?.let { it to c } }
        if (next == null || next.second == dismissed) { hide(); return }
        if (next == shown && card.visibility == View.VISIBLE) return
        shown = next
        showFound(next.first, next.second)
    }

    private fun hide() {
        shown = null
        card.visibility = View.GONE
        strip.visibility = View.VISIBLE
    }

    private fun close() {
        countdown?.let { handler.removeCallbacks(it) }
        countdown = null
        dismissed = shown?.second ?: currentLine()
        phase = Phase.IDLE
        hide()
    }

    private fun render(chip: String, title: String, sub: String, tone: Tone = Tone.NEUTRAL,
                       primary: Pair<String, () -> Unit>? = null, secondary: Pair<String, () -> Unit>? = null) {
        card.background = rounded(Color.parseColor("#141733"), 14f, Color.parseColor(tone.stroke))
        cardChip.text = chip
        cardChip.setTextColor(Color.parseColor(tone.chipInk))
        cardChip.background = rounded(Color.parseColor(tone.chipBg), 6f)
        cardTitle.text = title
        cardSub.text = sub
        cardSub.visibility = if (sub.isEmpty()) View.GONE else View.VISIBLE
        for ((view, action) in listOf(cardButton to primary, cardButton2 to secondary)) {
            if (action == null) { view.visibility = View.GONE; continue }
            view.text = action.first
            view.setOnClickListener { action.second() }
            view.visibility = View.VISIBLE
        }
        strip.visibility = View.GONE
        card.visibility = View.VISIBLE
    }

    private fun showFound(f: Found, text: String) {
        val signedIn = Api.signedIn(this)
        val fromCopy = text == copied && text != currentLine()
        when (f) {
            is Found.Split -> render(
                "Split · ${f.people} people", "${money(f.totalCents / f.people)} each",
                "${money(f.totalCents)} split ${f.people} ways. A pay link for each person, sent in this chat.",
                primary = if (signedIn) "Create split links" to { createSplit(f) } else "Sign in to split" to { openSetup() },
            )
            is Found.Pay -> render(
                "Pay", "${money(f.amountCents)} to ${shortTo(f.to)}",
                if (f.note.isNotEmpty()) "For ${f.note}. Shield checks who it goes to first." else "Shield checks who it goes to first.",
                primary = if (signedIn) "Pay ${money(f.amountCents)}" to { startCountdown(f, f.to) } else "Sign in to pay" to { openSetup() },
            )
            is Found.Address -> render(
                if (fromCopy) "Shield · you copied" else "Shield", "Check this address first",
                "${shortAddress(f.address)}. Shield compares it with the people you saved.",
                primary = "Check with Shield" to { checkAddress(f.address) },
            )
            is Found.Link -> render(
                if (fromCopy) "Shield · you copied" else "Shield", "Scan this link first", Uri.parse(f.url).host ?: f.url,
                primary = if (signedIn) "Scan with Shield" to { scanLink(f.url) } else "Sign in to scan" to { openSetup() },
            )
        }
    }

    private fun openSetup() {
        startActivity(Intent(this, SetupActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun busy(chip: String, title: String) {
        phase = Phase.BUSY
        render(chip, title, "")
    }

    private fun done(chip: String, title: String, sub: String, tone: Tone,
                     primary: Pair<String, () -> Unit>? = null, secondary: Pair<String, () -> Unit>? = null) {
        phase = Phase.DONE
        render(chip, title, sub, tone, primary, secondary)
    }

    /** Errors that every action handles the same way. */
    private fun failed(e: Throwable, retry: () -> Unit) {
        if (e is Api.NotSignedIn) done("Mlyfo", "Sign in to continue", "Your Mlyfo session ended.", Tone.WARN, "Sign in" to { openSetup() })
        else done("Mlyfo", "Couldn’t reach Mlyfo", "Check your connection and try again.", Tone.WARN, "Try again" to retry)
    }

    /** Puts Mlyfo's text into the chat, then steps the card aside. */
    private fun send(text: String, confirmation: String) {
        currentInputConnection?.commitText(text, 1)
        dismissed = currentLine()
        done("Mlyfo", confirmation, "", Tone.OK)
        handler.postDelayed({ if (phase == Phase.DONE) { phase = Phase.IDLE; hide() } }, 1800)
    }

    // ---- Shield ------------------------------------------------------------------------

    private fun checkAddress(address: String) {
        if (!Api.signedIn(this)) { checkAddressHere(address); return }
        busy("Shield", "Checking…")
        Api.run({ Api.post(this, "/api/shield/address", JSONObject().put("address", address)) }) { r ->
            r.onFailure { failed(it) { checkAddress(address) } }
            r.onSuccess { reply ->
                val findings = reply.json.optJSONArray("findings") ?: JSONArray()
                val list = (0 until findings.length()).map { findings.getJSONObject(it) }
                val top = list.firstOrNull { it.optString("level") == "block" } ?: list.firstOrNull { it.optString("level") == "warn" } ?: list.firstOrNull()
                val chain = if (reply.json.optString("chain") == "evm") "Ethereum and Base" else "Solana"
                val (tone, title) = when (top?.optString("level")) {
                    "block" -> Tone.BLOCK to "Blocked"
                    "ok" -> Tone.OK to "Looks fine"
                    else -> Tone.WARN to "Check before sending"
                }
                done("Shield · $chain", title, list.joinToString(" ") { it.optString("message") }, tone)
            }
        }
    }

    /** Without an account Shield can still tell a real address from a fake and spot the scam list. */
    private fun checkAddressHere(address: String) {
        val scam = address in setOf("ScAm1111DrainerXYZbad9pLmQ8rTvB3nYc7HsP4kJe6", "0x5cA1ab1e9D7E2A4b6C8d0E1f3A5b7C9d0E2F4B1d")
        val evm = EVM_ADDRESS.matches(address)
        when {
            scam -> done("Shield", "Blocked", "This address is on Mlyfo’s scam list.", Tone.BLOCK)
            evm || SOLANA_ADDRESS.matches(address) -> done(
                "Shield · ${if (evm) "Ethereum and Base" else "Solana"}", "A valid address",
                "Sign in so Shield can compare it with the people you saved.", Tone.WARN, "Sign in" to { openSetup() },
            )
            else -> done("Shield", "Not a valid address", "This isn’t a Solana, Ethereum or Base address.", Tone.BLOCK)
        }
    }

    private fun scanLink(url: String) {
        busy("Shield", "Scanning the link…")
        Api.run({ Api.post(this, "/api/shield/link", JSONObject().put("url", url).put("deep", false)) }) { r ->
            r.onFailure { failed(it) { scanLink(url) } }
            r.onSuccess { reply ->
                if (!reply.ok) {
                    done("Shield", "Couldn’t scan it", reply.error("That isn’t a link Shield can read."), Tone.WARN)
                } else {
                    val reasons = reply.json.optJSONArray("reasons") ?: JSONArray()
                    val why = (0 until minOf(2, reasons.length())).joinToString(" ") { reasons.optString(it) }
                    when (reply.json.optString("verdict")) {
                        "dangerous" -> done("Shield", "Dangerous link", why, Tone.BLOCK)
                        "risky" -> done("Shield", "Risky link", why, Tone.WARN)
                        else -> done("Shield", "No red flags", why, Tone.OK)
                    }
                }
            }
        }
    }

    // ---- Pay ---------------------------------------------------------------------------

    /** A few seconds to change your mind before anything is sent. */
    private fun startCountdown(f: Found.Pay, to: String) {
        phase = Phase.COUNTING
        var left = 5
        val tick = object : Runnable {
            override fun run() {
                if (left == 0) { countdown = null; pay(f, to); return }
                render("Sending", "${money(f.amountCents)} to ${shortTo(to)}", "Sending in ${left}s. Shield checks it first.",
                    primary = "Undo" to {
                        countdown?.let { c -> handler.removeCallbacks(c) }
                        countdown = null
                        done("Pay", "Not sent", "You stopped the payment.", Tone.NEUTRAL)
                    })
                left -= 1
                handler.postDelayed(this, 1000)
            }
        }
        countdown = tick
        tick.run()
    }

    private fun pay(f: Found.Pay, to: String) {
        busy("Pay", "Sending ${money(f.amountCents)}…")
        val body = JSONObject().put("to", to).put("amount", dollars(f.amountCents)).put("note", f.note)
        Api.run({ Api.post(this, "/api/pay", body) }) { r ->
            r.onFailure { failed(it) { pay(f, to) } }
            r.onSuccess { reply -> paid(reply, f, to) }
        }
    }

    private fun paid(reply: Api.Reply, f: Found.Pay, to: String) {
        val j = reply.json
        val reasons = j.optJSONArray("reasons") ?: JSONArray()
        val why = (0 until reasons.length()).joinToString(" ") { reasons.optString(it) }
        when (j.optString("status")) {
            "sent" -> showPaid("Paid ${money(f.amountCents)} to ${j.optString("to").ifEmpty { shortTo(to) }}",
                "${Api.BASE}/r/${j.optString("receipt_id")}", j.optString("receipt_id"))
            "needs_confirmation" -> done("Over your limit", "Confirm with your password", why, Tone.WARN,
                "Confirm" to {
                    startActivity(Intent(this, ConfirmActivity::class.java)
                        .putExtra("paymentId", j.optLong("paymentId"))
                        .putExtra("summary", "${money(f.amountCents)} to ${shortTo(to)}")
                        .putExtra("reason", why)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    phase = Phase.IDLE
                    hide()
                })
            "blocked" -> {
                val choices = j.optJSONArray("choices") ?: JSONArray()
                val pick: List<Pair<String, () -> Unit>> = (0 until minOf(2, choices.length())).map { i ->
                    val c = choices.getJSONObject(i)
                    val target = c.optString("to")
                    c.optString("label") to { startCountdown(f, target) }
                }
                val byShield = (j.optJSONArray("findings")?.length() ?: 0) > 0
                done(if (byShield) "Blocked by Shield" else "Not sent", if (pick.isEmpty()) "Not sent" else "Who did you mean?",
                    why.ifEmpty { reply.error("Mlyfo didn’t send it.") }, if (pick.isEmpty()) Tone.BLOCK else Tone.WARN,
                    pick.getOrNull(0), pick.getOrNull(1))
            }
            else -> done("Pay", "Not sent", reply.error("Mlyfo didn’t send it."), Tone.BLOCK)
        }
    }

    private fun showPaid(summary: String, url: String, receiptId: String?) {
        done("Paid", "$summary ✓", if (receiptId.isNullOrEmpty()) "Receipt ready." else "Receipt $receiptId", Tone.OK,
            "Share receipt" to { send("$summary ✓ Receipt: $url", "Receipt added to the chat") })
    }

    // ---- Split -------------------------------------------------------------------------

    private fun createSplit(f: Found.Split) {
        busy("Split", "Creating ${f.people - 1} pay links…")
        val names = f.names.ifEmpty { (1 until f.people).map { "Friend $it" } }
        val body = JSONObject().put("title", "Split").put("total", dollars(f.totalCents)).put("people", JSONArray(names))
        Api.run({ Api.post(this, "/api/splits", body) }) { r ->
            r.onFailure { failed(it) { createSplit(f) } }
            r.onSuccess { reply -> splitReady(reply, f) }
        }
    }

    private fun splitReady(reply: Api.Reply, f: Found.Split) {
        if (!reply.ok) { done("Split", "Couldn’t create the split", reply.error("Try again."), Tone.BLOCK); return }
        val shares = reply.json.optJSONArray("shares") ?: JSONArray()
        val others = (0 until shares.length()).map { shares.getJSONObject(it) }.filter { it.optInt("is_owner") == 0 }
        if (others.isEmpty()) { done("Split", "Couldn’t create the split", "No one to split with.", Tone.BLOCK); return }
        val each = others.first().optLong("amount_cents")
        val text = if (others.size == 1) {
            "Your share is ${money(each)}. Pay here: ${Api.BASE}/pay/${others.first().optString("token")}"
        } else {
            "Split ${money(f.totalCents)}, ${money(each)} each. Pay your share:\n" +
                others.joinToString("\n") { s -> "${s.optString("label").replaceFirstChar { it.uppercase() }}: ${Api.BASE}/pay/${s.optString("token")}" }
        }
        done("Split ready", "${others.size} pay link${if (others.size == 1) "" else "s"} ready", "${money(each)} each. Send them in this chat?", Tone.OK,
            "Send to chat" to { send(text, "Split links added to the chat") })
    }

    // ---- Keys --------------------------------------------------------------------------

    private fun renderKeys() {
        if (!::keys.isInitialized) return
        keys.removeAllViews()
        if (symbols) {
            row("1234567890".map { letter(it.toString()) })
            row("@#\$_&-+()/".map { letter(it.toString()) })
            row(listOf(fn("=") { type("=") }) + "*\"':;!?".map { letter(it.toString()) } + listOf(backspace()))
            row(listOf(fn("ABC", 1.5f) { symbols = false; renderKeys() }, letter(","), space(), letter("."), enter()))
        } else {
            row("qwertyuiop".map { letter(it.toString()) })
            row("asdfghjkl".map { letter(it.toString()) }, sidePadding = 0.5f)
            row(listOf(fn(if (shift) "⬆" else "⇧", 1.5f) { shift = !shift; renderKeys() }) + "zxcvbnm".map { letter(it.toString()) } + listOf(backspace()))
            val bottom = mutableListOf(fn("?123", 1.5f) { symbols = true; renderKeys() })
            if (shouldOfferSwitchingToNextInputMethod()) bottom.add(fn("🌐") { switchToNextInputMethod(false) })
            bottom.addAll(listOf(letter(","), space(), letter("."), enter()))
            row(bottom)
        }
    }

    private fun row(views: List<Pair<View, Float>>, sidePadding: Float = 0f) {
        val r = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        if (sidePadding > 0) r.addView(View(this), LinearLayout.LayoutParams(0, 1, sidePadding))
        for ((v, w) in views) {
            r.addView(v, LinearLayout.LayoutParams(0, dp(46f), w).apply { setMargins(dp(3f), dp(4f), dp(3f), dp(4f)) })
        }
        if (sidePadding > 0) r.addView(View(this), LinearLayout.LayoutParams(0, 1, sidePadding))
        keys.addView(r)
    }

    private fun key(text: String, color: Int, size: Float, onTap: () -> Unit): TextView =
        label(text, size, ink).apply {
            gravity = Gravity.CENTER
            background = rounded(color, 8f)
            setOnTouchListener { v, e ->
                when (e.action) {
                    MotionEvent.ACTION_DOWN -> { (v.background as GradientDrawable).setColor(keyDown); v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP) }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> (v.background as GradientDrawable).setColor(color)
                }
                false
            }
            setOnClickListener { onTap() }
        }

    private fun letter(c: String): Pair<View, Float> {
        val face = if (shift && !symbols) c.uppercase() else c
        return key(face, keyBg, 21f) {
            type(face)
            if (shift && !symbols) { shift = false; renderKeys() }
        } to 1f
    }

    private fun fn(text: String, weight: Float = 1f, onTap: () -> Unit): Pair<View, Float> = key(text, keyFn, 15f, onTap) to weight

    private fun space(): Pair<View, Float> = key("mlyfo", keyBg, 13f) { type(" ") }.apply { setTextColor(slate) } to 4f

    private fun enter(): Pair<View, Float> = key("⏎", Color.parseColor("#3443D9"), 18f) {
        typed()
        val info = currentInputEditorInfo
        val action = (info?.imeOptions ?: 0) and EditorInfo.IME_MASK_ACTION
        val noAction = ((info?.imeOptions ?: 0) and EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0
        if (!noAction && action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED) {
            currentInputConnection?.performEditorAction(action)
        } else {
            sendDownUpKeyEvents(KeyEvent.KEYCODE_ENTER)
        }
    } to 1.5f

    private fun backspace(): Pair<View, Float> {
        val repeat = object : Runnable {
            override fun run() { sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL); handler.postDelayed(this, 60) }
        }
        val v = key("⌫", keyFn, 18f) { typed(); sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL) }
        v.setOnLongClickListener { typed(); handler.post(repeat); true }
        val press = v.background as GradientDrawable
        v.setOnTouchListener { view, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> { press.setColor(keyDown); view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP) }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> { press.setColor(keyFn); handler.removeCallbacks(repeat) }
            }
            false
        }
        return v to 1.5f
    }

    /** You started typing again: a finished card makes way for what you type next. */
    private fun typed() {
        if (phase == Phase.DONE) phase = Phase.IDLE
    }

    private fun type(s: String) {
        typed()
        currentInputConnection?.commitText(s, 1)
    }

    private fun label(text: String, sp: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
        this.text = text
        setTextColor(color)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }
}
