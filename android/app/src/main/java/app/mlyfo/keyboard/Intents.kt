package app.mlyfo.keyboard

import java.util.Locale
import kotlin.math.roundToLong

/**
 * What a line of text asks for. A port of the web app's lib/intent.ts, limited to the
 * actions the keyboard can hand over to Mlyfo: split a bill, pay someone, check an
 * address, scan a link.
 */
sealed class Found {
    data class Split(val totalCents: Long, val people: Int) : Found()
    data class Pay(val amountCents: Long, val to: String, val note: String) : Found()
    data class Address(val address: String) : Found()
    data class Link(val url: String) : Found()
}

private val I = setOf(RegexOption.IGNORE_CASE)
private val URL = Regex("""https?://\S+""", I)
private val HANDLE = Regex("""@([a-z0-9_]{2,20})""", I)
private val SPLIT = Regex("""split\s+\$?([\d,.]+)\s*(?:/|ways?|by|between|among)?\s*(\d+)?""", I)
private val BILL = Regex("""\$([\d,.]+)\s+for\s+(\d+)\s+of\s+us""", I)
private val PAY = Regex(
    """^(?:pay|send)\s+(?:(@?[a-z0-9_]+)\s+\$?([\d,.]+)|\$?([\d,.]+)\s*(?:usdc|usd|dollars|bucks)?\s+to\s+(@?[a-z0-9_]+|[1-9A-HJ-NP-Za-km-z]{32,44}))(?:\s+(?:for\s+)?(.*))?$""",
    I,
)
private val ADDRESS = Regex("""\b0x[0-9a-fA-F]{40}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b""")

private fun cents(s: String): Long =
    ((s.replace(",", "").replace("$", "").toDoubleOrNull() ?: 0.0) * 100).roundToLong()

fun parseIntent(input: String): Found? {
    val t = input.trim()
    if (t.isEmpty()) return null

    URL.find(t)?.let { return Found.Link(it.value) }

    // "split 236 / 4", "split $236 with @kabir @zoya"
    val handles = HANDLE.findAll(t).map { it.groupValues[1].lowercase() }.toList()
    SPLIT.find(t)?.let { m ->
        val people = if (handles.isNotEmpty()) handles.size + 1 else (m.groupValues[2].toIntOrNull() ?: 2)
        val total = cents(m.groupValues[1])
        if (total > 0 && people > 1) return Found.Split(total, people)
    }
    // "bill was $236 for 4 of us"
    BILL.find(t)?.let { m ->
        val total = cents(m.groupValues[1])
        val people = m.groupValues[2].toIntOrNull() ?: 0
        if (total > 0 && people > 1) return Found.Split(total, people)
    }

    // "pay @kabir 10 for lunch", "send $50 to Ada"
    PAY.find(t)?.let { m ->
        val to = m.groupValues[1].ifEmpty { m.groupValues[4] }
        val amount = cents(m.groupValues[2].ifEmpty { m.groupValues[3] })
        if (to.isNotEmpty() && amount > 0) return Found.Pay(amount, to, m.groupValues[5].trim())
    }

    ADDRESS.find(t)?.let { return Found.Address(it.value) }
    return null
}

fun money(cents: Long): String = "$" + String.format(Locale.US, "%,.2f", cents / 100.0)

fun shortAddress(a: String): String = if (a.length > 12) a.take(4) + "…" + a.takeLast(4) else a
