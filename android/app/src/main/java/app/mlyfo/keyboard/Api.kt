package app.mlyfo.keyboard

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Talks to Mlyfo (mlyfo.vercel.app) with the same API the website uses. The keyboard only
 * calls it when you tap a Mlyfo card; it never sends what you type.
 *
 * Signing in stores Mlyfo's 30-day session in this app's private storage.
 */
object Api {
    const val BASE = "https://mlyfo.vercel.app"
    const val HOST = "mlyfo.vercel.app"
    const val DEMO_EMAIL = "demo@mlyfo.app"
    const val DEMO_PASSWORD = "mlyfo-demo-2026"

    class NotSignedIn : Exception()
    class Reply(val code: Int, val json: JSONObject) {
        val ok get() = code in 200..299
        fun error(fallback: String) = json.optString("error").ifEmpty { fallback }
    }

    private val pool = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    /** Runs [work] off the main thread and hands its result (or error) back on it. */
    fun <T> run(work: () -> T, done: (Result<T>) -> Unit) {
        pool.execute {
            val r = runCatching(work)
            main.post { done(r) }
        }
    }

    private fun prefs(c: Context) = c.getSharedPreferences("mlyfo", Context.MODE_PRIVATE)
    fun email(c: Context): String? = prefs(c).getString("email", null)
    fun signedIn(c: Context) = prefs(c).getString("session", null) != null
    fun signOut(c: Context) = prefs(c).edit().remove("session").remove("email").apply()

    /** A payment confirmed on the password screen, for the keyboard to show once. */
    fun saveReceipt(c: Context, summary: String, url: String) =
        prefs(c).edit().putString("receipt_summary", summary).putString("receipt_url", url).apply()
    fun takeReceipt(c: Context): Pair<String, String>? {
        val p = prefs(c)
        val s = p.getString("receipt_summary", null) ?: return null
        val u = p.getString("receipt_url", null) ?: return null
        p.edit().remove("receipt_summary").remove("receipt_url").apply()
        return s to u
    }

    /** Signs in and keeps the session. Returns an error message, or null when it worked. Call off the main thread. */
    fun signIn(c: Context, email: String, password: String): String? {
        val r = request("/api/auth/login", JSONObject().put("email", email.trim()).put("password", password), null)
        if (r.code !in 200..299) return r.json.optString("error").ifEmpty { "Couldn’t sign in. Check your connection." }
        val session = r.cookies.firstNotNullOfOrNull { Regex("mlyfo_session=([^;]+)").find(it)?.groupValues?.get(1) }
            ?: return "Mlyfo didn’t return a session. Try again."
        prefs(c).edit().putString("session", session).putString("email", email.trim().lowercase()).apply()
        return null
    }

    /** POSTs JSON as the signed-in person. Call off the main thread. */
    fun post(c: Context, path: String, body: JSONObject): Reply {
        val session = prefs(c).getString("session", null) ?: throw NotSignedIn()
        val r = request(path, body, session)
        // A wrong password on the confirm screen is also a 401; only an expired session signs you out.
        if (r.code == 401 && r.json.optString("error").startsWith("Sign in")) { signOut(c); throw NotSignedIn() }
        return Reply(r.code, r.json)
    }

    private class Raw(val code: Int, val json: JSONObject, val cookies: List<String>)

    private fun request(path: String, body: JSONObject, session: String?): Raw {
        val conn = URL(BASE + path).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 15000
            conn.readTimeout = 30000
            conn.doOutput = true
            conn.setRequestProperty("content-type", "application/json")
            conn.setRequestProperty("accept", "application/json")
            if (session != null) conn.setRequestProperty("cookie", "mlyfo_session=$session")
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = conn.responseCode
            val text = (if (code >= 400) conn.errorStream else conn.inputStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = try { JSONObject(text) } catch (e: Exception) { JSONObject() }
            val cookies = conn.headerFields.entries.filter { it.key?.equals("set-cookie", ignoreCase = true) == true }.flatMap { it.value }
            return Raw(code, json, cookies)
        } finally {
            conn.disconnect()
        }
    }
}
