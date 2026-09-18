package com.furkansogutma.app.feature.category.domain.model

data class Category(
    val id: String,
    val name: String,
    val slug: String,
    val description: String?,
    val parentId: String?,
    val image: String?,
    val children: List<Category>,
)
