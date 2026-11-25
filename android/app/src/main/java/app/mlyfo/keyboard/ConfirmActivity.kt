package app.mlyfo.keyboard

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

/**
 * A payment over your spend limit waits for your password. The keyboard opens this small
 * screen for it, then shows the receipt back in the chat.
 */
class ConfirmActivity : Activity() {

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val paymentId = intent.getLongExtra("paymentId", 0L)
        val summary = intent.getStringExtra("summary").orEmpty()
        val reason = intent.getStringExtra("reason").orEmpty()
        val ink = Color.parseColor("#F1F2F8")
        val slate = Color.parseColor("#A3A9BE")

        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24f), dp(56f), dp(24f), dp(24f))
            setBackgroundColor(Color.parseColor("#07080D"))
        }
        fun text(s: String, sp: Float, color: Int, bold: Boolean = false, top: Float = 0f) = TextView(this).apply {
            text = s
            setTextColor(color)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
            if (bold) typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(top), 0, 0)
        }.also { col.addView(it) }

        text("Confirm payment", 28f, ink, bold = true)
        text(summary, 20f, ink, top = 12f)
        if (reason.isNotEmpty()) text(reason, 14f, slate, top = 8f)

        val password = EditText(this).apply {
            hint = "Your Mlyfo password"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setTextColor(ink)
            setHintTextColor(Color.parseColor("#7A8199"))
            background = GradientDrawable().apply { setColor(Color.parseColor("#14161E")); cornerRadius = dp(12f).toFloat() }
            setPadding(dp(14f), dp(14f), dp(14f), dp(14f))
        }
        col.addView(password, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(20f) })

        val status = text("", 14f, Color.parseColor("#FFB3C8"), top = 10f).apply { visibility = View.GONE }

        val button = TextView(this).apply {
            text = "Confirm and send"
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#0B0C12"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            typeface = Typeface.DEFAULT_BOLD
            background = GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = dp(12f).toFloat() }
            setPadding(dp(18f), dp(14f), dp(18f), dp(14f))
        }
        col.addView(button, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(16f) })

        val cancel = text("Cancel", 15f, slate, top = 18f).apply { gravity = Gravity.CENTER; setOnClickListener { finish() } }
        cancel.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        button.setOnClickListener {
            val pw = password.text.toString()
            if (pw.isEmpty()) return@setOnClickListener
            button.isEnabled = false
            button.text = "Sending…"
            status.visibility = View.GONE
            Api.run({ Api.post(this, "/api/pay/confirm", JSONObject().put("paymentId", paymentId).put("password", pw)) }) { r ->
                button.isEnabled = true
                button.text = "Confirm and send"
                r.onFailure {
                    status.text = if (it is Api.NotSignedIn) "Your Mlyfo session ended. Sign in again in the Mlyfo Keyboard app." else "Couldn’t reach Mlyfo. Check your connection."
                    status.visibility = View.VISIBLE
                }
                r.onSuccess { reply ->
                    if (reply.json.optString("status") == "sent") {
                        val rid = reply.json.optString("receipt_id")
                        Api.saveReceipt(this, "Paid $summary", "${Api.BASE}/r/$rid")
                        password.setText("")
                        password.clearFocus()
                        status.setTextColor(Color.parseColor("#7FE3BC"))
                        status.text = "Paid ✓ Receipt $rid. Go back to the chat to share it."
                        status.visibility = View.VISIBLE
                        button.text = "Back to the chat"
                        button.setOnClickListener { finish() }
                    } else {
                        status.text = reply.error("The payment wasn’t sent.")
                        status.visibility = View.VISIBLE
                    }
                }
            }
        }

        setContentView(col)
    }
}
