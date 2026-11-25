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

/**
 * The Mlyfo keyboard (Android preview).
 *
 * It types like any keyboard. While you type, it reads only the line you are on, and it
 * looks at what you copy. When that asks for money (a split, a payment, a wallet address
 * or a link), a Mlyfo card appears above the keys. Tapping the card opens Mlyfo to finish
 * the action, where Shield checks it first. Nothing is sent anywhere until you tap.
 */
class MlyfoKeyboard : InputMethodService() {

    private val base = "https://mlyfo.vercel.app"
    private val night = Color.parseColor("#0B0C12")
    private val keyBg = Color.parseColor("#1F2230")
    private val keyFn = Color.parseColor("#2C2F3E")
    private val keyDown = Color.parseColor("#3A3E52")
    private val ink = Color.parseColor("#F1F2F8")
    private val slate = Color.parseColor("#A3A9BE")
    private val cobalt = Color.parseColor("#4B5BFF")
    private val cobaltInk = Color.parseColor("#9DA7FF")

    private lateinit var strip: LinearLayout
    private lateinit var card: LinearLayout
    private lateinit var cardChip: TextView
    private lateinit var cardTitle: TextView
    private lateinit var cardSub: TextView
    private lateinit var cardButton: TextView
    private lateinit var keys: LinearLayout

    private var shift = false
    private var symbols = false
    private var shown: Pair<Found, String>? = null
    private var dismissed: String? = null
    private var copied: String? = null

    private val handler = Handler(Looper.getMainLooper())
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
        super.onDestroy()
    }

    override fun onCreateInputView(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(night)
            setPadding(dp(6f), dp(6f), dp(6f), dp(8f))
        }

        // The strip above the keys when there is nothing to act on.
        strip = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8f), 0, dp(8f), 0)
        }
        val mark = View(this).apply { background = rounded(cobalt, 6f) }
        strip.addView(mark, LinearLayout.LayoutParams(dp(12f), dp(12f)))
        strip.addView(label("mlyfo", 14f, ink, bold = true).apply { setPadding(dp(8f), 0, 0, 0) })
        strip.addView(
            label("Try “split 236 / 4” or copy an address", 12f, slate).apply {
                gravity = Gravity.END
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
            },
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
        )
        root.addView(strip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(38f)))

        // The Mlyfo card.
        card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(Color.parseColor("#141733"), 14f, cobalt)
            setPadding(dp(14f), dp(12f), dp(14f), dp(12f))
            visibility = View.GONE
        }
        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        cardChip = label("", 12f, cobaltInk, bold = true).apply {
            background = rounded(Color.parseColor("#26306B"), 6f)
            setPadding(dp(8f), dp(3f), dp(8f), dp(3f))
        }
        top.addView(cardChip)
        top.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        val close = label("✕", 15f, slate).apply {
            setPadding(dp(10f), dp(2f), dp(4f), dp(2f))
            setOnClickListener { dismissed = shown?.second; show(null) }
        }
        top.addView(close)
        card.addView(top)
        cardTitle = label("", 20f, ink, bold = true).apply { setPadding(0, dp(8f), 0, 0) }
        card.addView(cardTitle)
        cardSub = label("", 13f, slate).apply { setPadding(0, dp(2f), 0, dp(10f)); maxLines = 2; ellipsize = TextUtils.TruncateAt.END }
        card.addView(cardSub)
        cardButton = label("", 14f, Color.parseColor("#0B0C12"), bold = true).apply {
            background = rounded(Color.WHITE, 10f)
            setPadding(dp(14f), dp(9f), dp(14f), dp(9f))
            setOnClickListener { open() }
        }
        card.addView(cardButton, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
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
        shift = capsHere()
        renderKeys()
        readClipboard()
        refresh()
    }

    override fun onUpdateSelection(oldSelStart: Int, oldSelEnd: Int, newSelStart: Int, newSelEnd: Int, candidatesStart: Int, candidatesEnd: Int) {
        super.onUpdateSelection(oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd)
        val caps = capsHere()
        if (caps && !shift && !symbols) { shift = true; renderKeys() }
        refresh()
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

    /** The line being typed wins; otherwise what was just copied. */
    private fun refresh() {
        if (!::card.isInitialized) return
        val before = currentInputConnection?.getTextBeforeCursor(280, 0)?.toString().orEmpty()
        val line = before.substringAfterLast('\n').trim()
        val typed = parseIntent(line)
        val next = when {
            typed != null -> typed to line
            else -> copied?.let { c -> parseIntent(c)?.let { it to c } }
        }
        if (next != null && next.second == dismissed) { show(null); return }
        show(next)
    }

    private fun show(found: Pair<Found, String>?) {
        shown = found
        if (found == null) {
            card.visibility = View.GONE
            strip.visibility = View.VISIBLE
            return
        }
        val fromCopy = found.second == copied && found.second != currentLine()
        when (val f = found.first) {
            is Found.Split -> {
                cardChip.text = "Split · ${f.people} people"
                cardTitle.text = "${money(f.totalCents / f.people)} each"
                cardSub.text = "${money(f.totalCents)} split ${f.people} ways. A payment link for each person."
                cardButton.text = "Create split links"
            }
            is Found.Pay -> {
                cardChip.text = "Pay"
                cardTitle.text = "${money(f.amountCents)} to ${f.to}"
                cardSub.text = if (f.note.isNotEmpty()) "For ${f.note}. Shield checks who it goes to first." else "Shield checks who it goes to first."
                cardButton.text = "Pay in Mlyfo"
            }
            is Found.Address -> {
                cardChip.text = if (fromCopy) "Shield · you copied" else "Shield"
                cardTitle.text = "Check this address first"
                cardSub.text = "${shortAddress(f.address)}. Shield compares it with the people you saved."
                cardButton.text = "Check with Shield"
            }
            is Found.Link -> {
                cardChip.text = if (fromCopy) "Shield · you copied" else "Shield"
                cardTitle.text = "Scan this link first"
                cardSub.text = Uri.parse(f.url).host ?: f.url
                cardButton.text = "Scan with Shield"
            }
        }
        strip.visibility = View.GONE
        card.visibility = View.VISIBLE
    }

    private fun currentLine(): String =
        currentInputConnection?.getTextBeforeCursor(280, 0)?.toString().orEmpty().substringAfterLast('\n').trim()

    /** Hands the action to Mlyfo, which checks it with Shield before any money moves. */
    private fun open() {
        val found = shown ?: return
        val url = when (val f = found.first) {
            is Found.Address -> "$base/k?address=" + Uri.encode(f.address)
            else -> "$base/k?text=" + Uri.encode(found.second.take(280))
        }
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    // ---- Keys ------------------------------------------------------------------------

    private fun renderKeys() {
        if (!::keys.isInitialized) return
        keys.removeAllViews()
        if (symbols) {
            row("1234567890".map { letter(it.toString()) })
            row("@#$_&-+()/".map { letter(it.toString()) })
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
        val v = key("⌫", keyFn, 18f) { sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL) }
        v.setOnLongClickListener { handler.post(repeat); true }
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

    private fun type(s: String) {
        currentInputConnection?.commitText(s, 1)
    }

    private fun label(text: String, sp: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
        this.text = text
        setTextColor(color)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }
}
