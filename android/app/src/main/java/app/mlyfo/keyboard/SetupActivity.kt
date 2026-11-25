package app.mlyfo.keyboard

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.util.TypedValue
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Opens from the app drawer: turn the keyboard on, switch to it, sign in, and try it. */
class SetupActivity : Activity() {

    private val ink = Color.parseColor("#F1F2F8")
    private val slate = Color.parseColor("#A3A9BE")
    private val mute = Color.parseColor("#7A8199")
    private lateinit var col: LinearLayout
    private lateinit var account: LinearLayout

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

    private fun text(parent: LinearLayout, s: String, sp: Float, color: Int, bold: Boolean = false, top: Float = 0f) = TextView(this).apply {
        text = s
        setTextColor(color)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        if (bold) typeface = Typeface.DEFAULT_BOLD
        setPadding(0, dp(top), 0, 0)
    }.also { parent.addView(it) }

    private fun button(parent: LinearLayout, s: String, filled: Boolean = true, onTap: () -> Unit) = TextView(this).apply {
        text = s
        setTextColor(if (filled) Color.parseColor("#0B0C12") else ink)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        typeface = Typeface.DEFAULT_BOLD
        background = GradientDrawable().apply {
            setColor(if (filled) Color.WHITE else Color.parseColor("#14161E"))
            cornerRadius = dp(12f).toFloat()
            if (!filled) setStroke(dp(1f), Color.parseColor("#3A3E52"))
        }
        setPadding(dp(18f), dp(14f), dp(18f), dp(14f))
        setOnClickListener { onTap() }
    }.also { parent.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(12f) }) }

    private fun field(parent: LinearLayout, hint: String, password: Boolean) = EditText(this).apply {
        this.hint = hint
        inputType = if (password) InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        setTextColor(ink)
        setHintTextColor(mute)
        background = GradientDrawable().apply { setColor(Color.parseColor("#14161E")); cornerRadius = dp(12f).toFloat() }
        setPadding(dp(14f), dp(14f), dp(14f), dp(14f))
    }.also { parent.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10f) }) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24f), dp(48f), dp(24f), dp(24f))
            setBackgroundColor(Color.parseColor("#07080D"))
        }

        text(col, "Mlyfo keyboard", 30f, ink, bold = true)
        text(col, "Android preview", 14f, Color.parseColor("#9DA7FF"), top = 4f)
        text(col, "Split a bill, pay a friend or check an address from any app you type in, without leaving the chat.", 16f, slate, top = 16f)

        button(col, "1. Turn on the Mlyfo keyboard") { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) }
        button(col, "2. Switch to Mlyfo") { (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).showInputMethodPicker() }

        text(col, "3. Sign in to pay and split", 16f, ink, bold = true, top = 28f)
        text(col, "Typing and address checks work without an account. Paying and split links use your Mlyfo account.", 14f, slate, top = 4f)
        account = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(account)
        showAccount()

        text(col, "4. Try it here", 16f, ink, bold = true, top = 28f)
        text(col, "Type “split 236 / 4”, “pay @kabir 10 for lunch”, or copy a wallet address.", 14f, slate, top = 4f)
        field(col, "Type here", password = false).inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES

        text(col,
            "Privacy: Mlyfo reads only the line you are typing and what you copy, on your phone, and never password fields. " +
                "Keystrokes are never logged or sent. It talks to mlyfo.vercel.app only when you tap a Mlyfo card, " +
                "and sends only what that card needs: the address to check, or the payment or split you asked for.",
            13f, mute, top = 28f)
        text(col, "Wallet signing on the phone with Seed Vault on Solana Seeker is next.", 13f, mute, top = 8f)

        setContentView(ScrollView(this).apply { setBackgroundColor(Color.parseColor("#07080D")); addView(col) })
    }

    /** Signed in: who, and a way out. Signed out: email and password, or the demo account. */
    private fun showAccount() {
        account.removeAllViews()
        val email = Api.email(this)
        if (Api.signedIn(this) && email != null) {
            text(account, "Signed in as $email", 15f, Color.parseColor("#7FE3BC"), top = 12f)
            button(account, "Sign out", filled = false) { Api.signOut(this); showAccount() }
            return
        }
        val emailField = field(account, "Email", password = false)
        val passwordField = field(account, "Password", password = true)
        val status = text(account, "", 14f, Color.parseColor("#FFB3C8"), top = 8f).apply { visibility = View.GONE }
        fun signIn(e: String, p: String) {
            status.setTextColor(slate)
            status.text = "Signing in…"
            status.visibility = View.VISIBLE
            Api.run({ Api.signIn(this, e, p) }) { r ->
                val error = r.getOrElse { "Couldn’t reach Mlyfo. Check your connection." }
                if (error == null) {
                    showAccount()
                } else {
                    status.setTextColor(Color.parseColor("#FFB3C8"))
                    status.text = error
                }
            }
        }
        button(account, "Sign in") { signIn(emailField.text.toString(), passwordField.text.toString()) }
        button(account, "Use the demo account", filled = false) { signIn(Api.DEMO_EMAIL, Api.DEMO_PASSWORD) }
        text(account, "No account? Create one free at mlyfo.vercel.app.", 13f, mute, top = 8f)
    }
}
