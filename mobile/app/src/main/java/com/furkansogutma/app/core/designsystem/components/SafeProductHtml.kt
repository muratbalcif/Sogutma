package com.furkansogutma.app.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.furkansogutma.app.core.designsystem.theme.Outline
import com.furkansogutma.app.core.designsystem.theme.Primary
import com.furkansogutma.app.core.designsystem.theme.PrimaryLight
import com.furkansogutma.app.core.designsystem.theme.Surface

private val ALLOWED_TAGS = setOf(
    "h2", "h3", "p", "strong", "em", "b", "i",
    "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "br", "a",
)

/**
 * Controlled allowlist HTML renderer for product content.
 * Does not use an unrestricted WebView.
 */
@Composable
fun SafeProductHtml(
    html: String?,
    modifier: Modifier = Modifier,
) {
    if (html.isNullOrBlank()) return
    val blocks = remember(html) { parseProductHtml(html) }
    if (blocks.isEmpty()) return
    Column(modifier = modifier.fillMaxWidth()) {
        blocks.forEach { block ->
            when (block) {
                is HtmlBlock.Heading -> Text(
                    text = block.text,
                    style = when (block.level) {
                        2 -> MaterialTheme.typography.titleMedium
                        else -> MaterialTheme.typography.titleSmall
                    },
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                )
                is HtmlBlock.Paragraph -> LinkAwareText(
                    annotated = block.text,
                    modifier = Modifier.padding(vertical = 2.dp),
                )
                is HtmlBlock.BulletList -> Column(Modifier.padding(vertical = 4.dp)) {
                    block.items.forEach { item ->
                        Row(Modifier.padding(vertical = 2.dp)) {
                            Text("•  ", color = Primary)
                            LinkAwareText(item, Modifier.weight(1f))
                        }
                    }
                }
                is HtmlBlock.NumberedList -> Column(Modifier.padding(vertical = 4.dp)) {
                    block.items.forEachIndexed { index, item ->
                        Row(Modifier.padding(vertical = 2.dp)) {
                            Text("${index + 1}.  ", color = Primary)
                            LinkAwareText(item, Modifier.weight(1f))
                        }
                    }
                }
                is HtmlBlock.Table -> Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp)
                        .border(1.dp, Outline, RoundedCornerShape(8.dp)),
                ) {
                    block.rows.forEachIndexed { rowIndex, row ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .background(
                                    if (row.isHeader || rowIndex % 2 == 0) {
                                        PrimaryLight.copy(alpha = 0.45f)
                                    } else {
                                        Surface
                                    },
                                )
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                        ) {
                            row.cells.forEach { cell ->
                                Text(
                                    text = cell,
                                    modifier = Modifier.weight(1f),
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = if (row.isHeader) FontWeight.SemiBold else FontWeight.Normal,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LinkAwareText(annotated: AnnotatedString, modifier: Modifier = Modifier) {
    val uriHandler = LocalUriHandler.current
    if (annotated.getStringAnnotations("URL", 0, annotated.length).isEmpty()) {
        Text(text = annotated, modifier = modifier, style = MaterialTheme.typography.bodyMedium)
    } else {
        ClickableText(
            text = annotated,
            modifier = modifier,
            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
            onClick = { offset ->
                annotated.getStringAnnotations("URL", offset, offset)
                    .firstOrNull()
                    ?.let { ann ->
                        val url = ann.item
                        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
                            runCatching { uriHandler.openUri(url) }
                        }
                    }
            },
        )
    }
}

internal sealed interface HtmlBlock {
    data class Heading(val level: Int, val text: String) : HtmlBlock
    data class Paragraph(val text: AnnotatedString) : HtmlBlock
    data class BulletList(val items: List<AnnotatedString>) : HtmlBlock
    data class NumberedList(val items: List<AnnotatedString>) : HtmlBlock
    data class Table(val rows: List<TableRow>) : HtmlBlock
    data class TableRow(val cells: List<String>, val isHeader: Boolean)
}

internal fun parseProductHtml(raw: String): List<HtmlBlock> {
    val sanitized = stripDisallowed(raw)
    val blocks = mutableListOf<HtmlBlock>()
    val tagRegex = Regex(
        """<(h2|h3|p|ul|ol|table)(\s[^>]*)?>[\s\S]*?</\1>|<br\s*/?>""",
        RegexOption.IGNORE_CASE,
    )
    var last = 0
    for (match in tagRegex.findAll(sanitized)) {
        val before = sanitized.substring(last, match.range.first).trim()
        if (before.isNotEmpty()) {
            blocks += HtmlBlock.Paragraph(parseInline(before))
        }
        val token = match.value
        when {
            token.startsWith("<br", ignoreCase = true) -> Unit
            token.startsWith("<h2", ignoreCase = true) ->
                blocks += HtmlBlock.Heading(2, stripTags(innerHtml(token, "h2")))
            token.startsWith("<h3", ignoreCase = true) ->
                blocks += HtmlBlock.Heading(3, stripTags(innerHtml(token, "h3")))
            token.startsWith("<p", ignoreCase = true) ->
                blocks += HtmlBlock.Paragraph(parseInline(innerHtml(token, "p")))
            token.startsWith("<ul", ignoreCase = true) ->
                blocks += HtmlBlock.BulletList(parseListItems(innerHtml(token, "ul")))
            token.startsWith("<ol", ignoreCase = true) ->
                blocks += HtmlBlock.NumberedList(parseListItems(innerHtml(token, "ol")))
            token.startsWith("<table", ignoreCase = true) ->
                blocks += HtmlBlock.Table(parseTable(innerHtml(token, "table")))
        }
        last = match.range.last + 1
    }
    val trailing = sanitized.substring(last).trim()
    if (trailing.isNotEmpty()) {
        blocks += HtmlBlock.Paragraph(parseInline(trailing))
    }
    return blocks
}

private fun stripDisallowed(html: String): String {
    var out = html
        .replace(Regex("""<(script|iframe|object|embed|form|style|link|meta)[^>]*>[\s\S]*?</\1>""", RegexOption.IGNORE_CASE), "")
        .replace(Regex("""<(script|iframe|object|embed|form|style|link|meta)[^>]*/?>""", RegexOption.IGNORE_CASE), "")
        .replace(Regex("""\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)""", RegexOption.IGNORE_CASE), "")
        .replace(Regex("""javascript:""", RegexOption.IGNORE_CASE), "")
    out = Regex("""</?([a-zA-Z0-9]+)(\s[^>]*)?/?>""").replace(out) { m ->
        val name = m.groupValues[1].lowercase()
        if (name in ALLOWED_TAGS) m.value else ""
    }
    return out
}

private fun innerHtml(block: String, tag: String): String {
    val open = Regex("""^<$tag(\s[^>]*)?>""", RegexOption.IGNORE_CASE)
    val close = Regex("""</$tag>$""", RegexOption.IGNORE_CASE)
    return block.replace(open, "").replace(close, "").trim()
}

private fun parseListItems(inner: String): List<AnnotatedString> =
    Regex("""<li(\s[^>]*)?>([\s\S]*?)</li>""", RegexOption.IGNORE_CASE)
        .findAll(inner)
        .map { parseInline(it.groupValues[2]) }
        .toList()

private fun parseTable(inner: String): List<HtmlBlock.TableRow> {
    val rows = mutableListOf<HtmlBlock.TableRow>()
    Regex("""<tr(\s[^>]*)?>([\s\S]*?)</tr>""", RegexOption.IGNORE_CASE).findAll(inner).forEach { tr ->
        val rowHtml = tr.groupValues[2]
        val th = Regex("""<th(\s[^>]*)?>([\s\S]*?)</th>""", RegexOption.IGNORE_CASE)
            .findAll(rowHtml)
            .map { stripTags(it.groupValues[2]).trim() }
            .toList()
        if (th.isNotEmpty()) {
            rows += HtmlBlock.TableRow(th, isHeader = true)
        } else {
            val td = Regex("""<td(\s[^>]*)?>([\s\S]*?)</td>""", RegexOption.IGNORE_CASE)
                .findAll(rowHtml)
                .map { stripTags(it.groupValues[2]).trim() }
                .toList()
            if (td.isNotEmpty()) {
                rows += HtmlBlock.TableRow(td, isHeader = false)
            }
        }
    }
    return rows
}

private fun parseInline(html: String): AnnotatedString = buildAnnotatedString {
    var i = 0
    val input = html
    while (i < input.length) {
        when {
            input.startsWith("<br", i, ignoreCase = true) -> {
                append('\n')
                val gt = input.indexOf('>', i)
                i = if (gt < 0) input.length else gt + 1
            }
            input.startsWith("<strong", i, ignoreCase = true) ||
                input.regionMatches(i, "<b>", 0, 3, ignoreCase = true) ||
                input.regionMatches(i, "<b ", 0, 3, ignoreCase = true) -> {
                val tag = if (input.startsWith("<strong", i, ignoreCase = true)) "strong" else "b"
                val end = input.indexOf("</$tag>", i, ignoreCase = true)
                val startClose = input.indexOf('>', i)
                if (end < 0 || startClose < 0) {
                    append(input[i])
                    i++
                } else {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(stripTags(input.substring(startClose + 1, end)))
                    }
                    i = end + tag.length + 3
                }
            }
            input.startsWith("<em", i, ignoreCase = true) ||
                input.regionMatches(i, "<i>", 0, 3, ignoreCase = true) ||
                input.regionMatches(i, "<i ", 0, 3, ignoreCase = true) -> {
                val tag = if (input.startsWith("<em", i, ignoreCase = true)) "em" else "i"
                val end = input.indexOf("</$tag>", i, ignoreCase = true)
                val startClose = input.indexOf('>', i)
                if (end < 0 || startClose < 0) {
                    append(input[i])
                    i++
                } else {
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(stripTags(input.substring(startClose + 1, end)))
                    }
                    i = end + tag.length + 3
                }
            }
            input.startsWith("<a ", i, ignoreCase = true) || input.startsWith("<a>", i, ignoreCase = true) -> {
                val end = input.indexOf("</a>", i, ignoreCase = true)
                val startClose = input.indexOf('>', i)
                if (end < 0 || startClose < 0) {
                    append(input[i])
                    i++
                } else {
                    val openTag = input.substring(i, startClose + 1)
                    val href = Regex("""href\s*=\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
                        .find(openTag)?.groupValues?.get(1).orEmpty()
                    val label = stripTags(input.substring(startClose + 1, end))
                    val safe = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")
                    if (safe) {
                        pushStringAnnotation("URL", href)
                        withStyle(
                            SpanStyle(
                                color = Primary,
                                textDecoration = TextDecoration.Underline,
                            ),
                        ) { append(label) }
                        pop()
                    } else {
                        append(label)
                    }
                    i = end + 4
                }
            }
            input[i] == '<' -> {
                val gt = input.indexOf('>', i)
                i = if (gt < 0) input.length else gt + 1
            }
            input.startsWith("&amp;", i) -> { append('&'); i += 5 }
            input.startsWith("&lt;", i) -> { append('<'); i += 4 }
            input.startsWith("&gt;", i) -> { append('>'); i += 4 }
            input.startsWith("&quot;", i) -> { append('"'); i += 6 }
            input.startsWith("&#39;", i) -> { append('\''); i += 5 }
            input.startsWith("&nbsp;", i) -> { append(' '); i += 6 }
            else -> {
                append(input[i])
                i++
            }
        }
    }
}

private fun stripTags(html: String): String =
    decodeEntities(html.replace(Regex("<[^>]+>"), ""))

private fun decodeEntities(text: String): String =
    text
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
