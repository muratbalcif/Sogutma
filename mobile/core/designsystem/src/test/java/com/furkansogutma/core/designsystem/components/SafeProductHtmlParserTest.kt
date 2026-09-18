package com.furkansogutma.core.designsystem.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SafeProductHtmlParserTest {
    @Test
    fun stripsScriptAndKeepsParagraph() {
        val blocks = parseProductHtml("<p>OK</p><script>alert(1)</script>")
        assertEquals(1, blocks.size)
        assertTrue(blocks.first() is HtmlBlock.Paragraph)
        assertTrue(blocks.first().toString().contains("OK"))
        assertFalse(blocks.toString().contains("alert"))
    }

    @Test
    fun parsesTableRows() {
        val blocks = parseProductHtml(
            "<table><tr><th>A</th></tr><tr><td>1</td></tr></table>",
        )
        assertEquals(1, blocks.size)
        val table = blocks.first() as HtmlBlock.Table
        assertEquals(2, table.rows.size)
        assertEquals(listOf("A"), table.rows[0].cells)
        assertTrue(table.rows[0].isHeader)
        assertEquals(listOf("1"), table.rows[1].cells)
    }

    @Test
    fun stripsEventHandlers() {
        val blocks = parseProductHtml("""<p onclick="evil()">safe</p>""")
        assertEquals(1, blocks.size)
        assertFalse(blocks.toString().contains("evil"))
        assertTrue(blocks.toString().contains("safe"))
    }
}
