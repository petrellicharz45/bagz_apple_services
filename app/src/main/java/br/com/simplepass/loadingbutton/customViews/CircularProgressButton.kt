package br.com.simplepass.loadingbutton.customViews

import android.content.Context
import android.util.AttributeSet
import com.google.android.material.button.MaterialButton

class CircularProgressButton @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = com.google.android.material.R.attr.materialButtonStyle
) : MaterialButton(context, attrs, defStyleAttr) {

    private var originalText: CharSequence? = text
    private var loading = false

    fun startAnimation() {
        if (loading) return
        originalText = text
        loading = true
        isEnabled = false
        text = "Please wait..."
    }

    fun revertAnimation() {
        loading = false
        isEnabled = true
        text = originalText
    }
}
