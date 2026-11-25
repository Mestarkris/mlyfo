package app.mlyfo.keyboard

import java.util.Locale
import kotlin.math.roundToLong

/**
 * What a line of text asks for. A port of the web app's lib/intent.ts, limited to what the
 * keyboard acts on: split a bill, pay someone, check an address, scan a link.
 */
sealed class Found {
    data class Split(val totalCents: Long, val people: Int, val names: List<String>) : Found()
    data class Pay(val amountCents: Long, val to: String, val note: String) : Found()
    data class Address(val address: String) : Found()
    data class Link(val url: String) : Found()
}

private val I = setOf(RegexOption.IGNORE_CASE)
private val URL = Regex("""https?://\S+""", I)
private val HANDLE = Regex("""@([a-z0-9_]{2,20})""", I)
private val SPLIT = Regex("""split\s+\$?([\d,.]+)\s*(?:/|ways?|by|between|among)?\s*(\d+)?""", I)
private val SPLIT_WITH = Regex("""split(?:\s+(?:the|this|our))?(?:\s+bill)?\s+(?:with|between)\s+(.+?)\s*(?:@|for|of|:)?\s*\$\s?([\d,.]+)""", I)
private val NAME_SEP = Regex("""\s*(?:,|&|\band\b)\s*|\s+""", I)
private val NAME = Regex("""^[a-z0-9_]{2,20}$""")
private val BILL = Regex("""\$([\d,.]+)\s+for\s+(\d+)\s+of\s+us""", I)
private val PAY = Regex(
    """^(?:pay|send)\s+(?:(@?[a-z0-9_]+)\s+\$?([\d,.]+)|\$?([\d,.]+)\s*(?:usdc|usd|dollars|bucks)?\s+to\s+(@?[a-z0-9_]+|[1-9A-HJ-NP-Za-km-z]{32,44}))(?:\s+(?:for\s+)?(.*))?$""",
    I,
)
val SOLANA_ADDRESS = Regex("""^[1-9A-HJ-NP-Za-km-z]{32,44}$""")
val EVM_ADDRESS = Regex("""^0x[0-9a-fA-F]{40}$""")
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
        if (total > 0 && people > 1) return Found.Split(total, people, handles)
    }
    // "split bill with kabir @ $50", "split the bill with @ada and @kabir for $90"
    SPLIT_WITH.find(t)?.let { m ->
        val names = m.groupValues[1].split(NAME_SEP).map { it.removePrefix("@").lowercase() }.filter { NAME.matches(it) && it != "me" }
        val total = cents(m.groupValues[2])
        if (names.isNotEmpty() && total > 0) return Found.Split(total, names.size + 1, names)
    }
    // "bill was $236 for 4 of us"
    BILL.find(t)?.let { m ->
        val total = cents(m.groupValues[1])
        val people = m.groupValues[2].toIntOrNull() ?: 0
        if (total > 0 && people > 1) return Found.Split(total, people, emptyList())
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

/** Dollars as the API takes them, e.g. "10.00". */
fun dollars(cents: Long): String = String.format(Locale.US, "%.2f", cents / 100.0)

fun shortAddress(a: String): String = if (a.length > 12) a.take(4) + "…" + a.takeLast(4) else a

/** Recipients that are wallet addresses read better shortened. */
fun shortTo(to: String): String = if (SOLANA_ADDRESS.matches(to) || EVM_ADDRESS.matches(to)) shortAddress(to) else to
