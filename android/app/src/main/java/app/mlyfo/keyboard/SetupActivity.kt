package app.mlyfo.keyboard

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.provider.Settings
import android.util.TypedValue
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Opens from the app drawer: turn the keyboard on, switch to it, and try it. */
class SetupActivity : Activity() {

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val ink = Color.parseColor("#F1F2F8")
        val slate = Color.parseColor("#A3A9BE")

        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24f), dp(48f), dp(24f), dp(24f))
            setBackgroundColor(Color.parseColor("#07080D"))
        }
        fun text(s: String, sp: Float, color: Int, bold: Boolean = false, top: Float = 0f) =
            col.addView(TextView(this).apply {
                text = s
                setTextColor(color)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
                if (bold) typeface = Typeface.DEFAULT_BOLD
                setPadding(0, dp(top), 0, 0)
            })
        fun button(s: String, onTap: () -> Unit) =
            col.addView(TextView(this).apply {
                text = s
                setTextColor(Color.parseColor("#0B0C12"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
                typeface = Typeface.DEFAULT_BOLD
                background = GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = dp(12f).toFloat() }
                setPadding(dp(18f), dp(14f), dp(18f), dp(14f))
                setOnClickListener { onTap() }
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(12f) })

        text("Mlyfo keyboard", 30f, ink, bold = true)
        text("Android preview", 14f, Color.parseColor("#9DA7FF"), top = 4f)
        text("Split a bill, pay a friend or check an address from any app you type in.", 16f, slate, top = 16f)

        button("1. Turn on the Mlyfo keyboard") { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) }
        button("2. Switch to Mlyfo") { (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).showInputMethodPicker() }

        text("3. Try it here", 16f, ink, bold = true, top = 28f)
        text("Type “split 236 / 4”, “pay @kabir 10 for lunch”, or copy a wallet address.", 14f, slate, top = 4f)
        col.addView(EditText(this).apply {
            hint = "Type here"
            setTextColor(ink)
            setHintTextColor(Color.parseColor("#7A8199"))
            background = GradientDrawable().apply { setColor(Color.parseColor("#14161E")); cornerRadius = dp(12f).toFloat() }
            setPadding(dp(14f), dp(14f), dp(14f), dp(14f))
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10f) })

        text(
            "Privacy: Mlyfo reads only the line you are typing and what you copy, on your phone. " +
                "Keystrokes are never logged or sent. Nothing leaves your phone until you tap a Mlyfo card, " +
                "which opens mlyfo.vercel.app with that one line.",
            13f, Color.parseColor("#7A8199"), top = 28f,
        )
        text("Payments are finished in Mlyfo, where Shield checks them first. Wallet signing on the phone is coming next.", 13f, Color.parseColor("#7A8199"), top = 8f)

        setContentView(ScrollView(this).apply { setBackgroundColor(Color.parseColor("#07080D")); addView(col) })
    }
}
