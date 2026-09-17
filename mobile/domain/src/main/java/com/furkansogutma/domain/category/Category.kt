package com.furkansogutma.domain.category

data class Category(
    val id: String,
    val name: String,
    val slug: String,
    val description: String?,
    val parentId: String?,
    val children: List<Category>,
)
