package dev.padlink.btpad

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.TextView

class MainActivity : Activity() {

    private lateinit var status: TextView
    private val pad = HidGamepad { msg -> runOnUiThread { status.text = msg } }
    private var started = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        status = findViewById(R.id.txtStatus)

        findViewById<Button>(R.id.btnDiscover).setOnClickListener {
            if (!hasPermissions()) { requestBtPermissions(); return@setOnClickListener }
            startActivity(
                Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE)
                    .putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 300)
            )
        }

        // Standard HID button order: 1=A 2=B 3=X 4=Y 5=LB 6=RB 7=Select 8=Start
        bindButton(R.id.btnA, 0)
        bindButton(R.id.btnB, 1)
        bindButton(R.id.btnX, 2)
        bindButton(R.id.btnY, 3)
        bindButton(R.id.btnLb, 4)
        bindButton(R.id.btnRb, 5)
        bindButton(R.id.btnSelect, 6)
        bindButton(R.id.btnStart, 7)

        bindHat(R.id.btnUp, 0)
        bindHat(R.id.btnRight, 2)
        bindHat(R.id.btnDown, 4)
        bindHat(R.id.btnLeft, 6)

        if (hasPermissions()) startHid() else requestBtPermissions()
    }

    private fun hasPermissions(): Boolean {
        if (Build.VERSION.SDK_INT < 31) return true
        return arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE)
            .all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
    }

    private fun requestBtPermissions() {
        if (Build.VERSION.SDK_INT >= 31) {
            requestPermissions(
                arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE),
                1,
            )
        }
    }

    override fun onRequestPermissionsResult(code: Int, perms: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, perms, results)
        if (hasPermissions()) startHid()
        else status.text = "Bluetooth permission denied — grant it in Settings to continue"
    }

    private fun startHid() {
        if (started) return
        started = true
        status.text = "Starting Bluetooth HID…"
        pad.start(this)
    }

    private fun bindButton(id: Int, bit: Int) {
        findViewById<Button>(id).setOnTouchListener { v, e -> handleTouch(v, e) { down -> pad.press(bit, down) } }
    }

    private fun bindHat(id: Int, direction: Int) {
        findViewById<Button>(id).setOnTouchListener { v, e ->
            handleTouch(v, e) { down -> pad.moveHat(if (down) direction else HidGamepad.HAT_NEUTRAL) }
        }
    }

    private inline fun handleTouch(v: View, e: MotionEvent, apply: (Boolean) -> Unit): Boolean {
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> { v.isPressed = true; apply(true) }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> { v.isPressed = false; apply(false) }
        }
        return true
    }

    override fun onDestroy() {
        super.onDestroy()
        pad.stop()
    }
}
