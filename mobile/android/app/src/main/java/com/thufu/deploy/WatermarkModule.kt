package com.thufu.deploy

import android.graphics.*
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.min

class WatermarkModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "WatermarkModule"

    @ReactMethod
    fun addWatermark(
        imageUri: String,
        siteId: String,
        siteName: String,
        latitude: Double,
        longitude: Double,
        timestamp: String,
        promise: Promise
    ) {
        try {
            val ctx = reactApplicationContext

            // Parse source image
            val inputStream = if (imageUri.startsWith("content://")) {
                ctx.contentResolver.openInputStream(android.net.Uri.parse(imageUri))
            } else {
                File(imageUri).inputStream()
            } ?: throw Exception("Cannot open image URI")

            val originalBitmap = BitmapFactory.decodeStream(inputStream)
            inputStream.close()

            if (originalBitmap == null) {
                promise.reject("E_DECODE", "Failed to decode image")
                return
            }

            val mutableBitmap = originalBitmap.copy(Bitmap.Config.ARGB_8888, true)
            originalBitmap.recycle()

            val w = mutableBitmap.width
            val h = mutableBitmap.height
            val canvas = Canvas(mutableBitmap)

            // ── Bottom-right corner watermark box ──────────────────────────────
            // Box width: 42% of image width, height: auto (proportional to content)
            val boxW = (w * 0.42f).toInt().coerceAtLeast(240)
            val boxH = (h * 0.22f).toInt().coerceAtLeast(100)
            val boxX = w - boxW   // right edge
            val boxY = h - boxH   // bottom edge

            // Semi-transparent black background (40% opacity)
            val bgPaint = Paint().apply {
                color = Color.argb(102, 0, 0, 0)
            }
            canvas.drawRect(boxX.toFloat(), boxY.toFloat(), w.toFloat(), h.toFloat(), bgPaint)

            // White monospace text paint
            val textPaint = Paint(TextPaint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                textSize = (w * 0.032f).coerceAtLeast(24f)
                typeface = Typeface.MONOSPACE
            }

            val dimTextPaint = Paint(TextPaint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(200, 220, 220, 220)
                textSize = (w * 0.026f).coerceAtLeast(20f)
                typeface = Typeface.MONOSPACE
            }

            // Content lines (right-aligned)
            val padX = (w * 0.025f).toInt().coerceAtLeast(12)
            val padY = (h * 0.018f).toInt().coerceAtLeast(8)
            val lineSpacing = textPaint.fontSpacing + 4f

            val latStr = String.format(Locale.US, "%.6f", latitude)
            val lngStr = String.format(Locale.US, "%.6f", longitude)
            val displayName = if (siteName.length > 30) siteName.take(27) + "…" else siteName

            val lines = listOf(
                siteId,              // line 0 — white, larger
                displayName,         // line 1 — dimmer
                "$latStr, $lngStr",  // line 2 — white
                timestamp            // line 3 — dimmer
            )

            // Draw each line right-aligned
            lines.forEachIndexed { i, line ->
                val lineY = boxY + padY + textPaint.fontSpacing + (i * lineSpacing)
                val paint = if (i == 0 || i == 2) textPaint else dimTextPaint
                // Measure text width for right-align
                val textWidth = paint.measureText(line)
                val x = (boxX + boxW - padX).toFloat() - textWidth
                canvas.drawText(line, x.coerceAtLeast(boxX.toFloat()), lineY, paint)
            }

            // Save watermarked image to app cache
            val outDir = File(ctx.cacheDir, "watermarked")
            if (!outDir.exists()) outDir.mkdirs()

            val outFile = File(outDir, "WM_${System.currentTimeMillis()}.jpg")
            FileOutputStream(outFile).use { fos ->
                mutableBitmap.compress(Bitmap.CompressFormat.JPEG, 90, fos)
            }

            mutableBitmap.recycle()

            // Return URI (file:// path)
            val resultUri = "file://${outFile.absolutePath}"
            promise.resolve(resultUri)

        } catch (e: Exception) {
            promise.reject("E_WATERMARK", "Watermark failed: ${e.message}", e)
        }
    }
}
