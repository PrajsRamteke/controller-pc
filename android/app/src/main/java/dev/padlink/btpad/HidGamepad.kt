package dev.padlink.btpad

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothHidDevice
import android.bluetooth.BluetoothHidDeviceAppSdpSettings
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import java.util.concurrent.Executors

/**
 * Registers the phone as a Bluetooth HID gamepad (device role) so a TV can
 * pair with it and see a standard controller.
 *
 * Report layout (report ID 1, 7 bytes):
 *   [0] X   left stick   0..255, 128 = center
 *   [1] Y   left stick
 *   [2] Z   right stick
 *   [3] Rz  right stick
 *   [4] hat switch in low nibble (0=N .. 7=NW, 8 = released)
 *   [5] buttons 1-8   (bit0 = button 1)
 *   [6] buttons 9-16
 */
@SuppressLint("MissingPermission") // caller checks BLUETOOTH_CONNECT before start()
class HidGamepad(private val onStatus: (String) -> Unit) {

    companion object {
        const val HAT_NEUTRAL = 8

        val DESCRIPTOR = byteArrayOf(
            0x05, 0x01,                    // Usage Page (Generic Desktop)
            0x09, 0x05,                    // Usage (Gamepad)
            0xA1.toByte(), 0x01,           // Collection (Application)
            0x85.toByte(), 0x01,           //   Report ID (1)
            0x09, 0x01,                    //   Usage (Pointer)
            0xA1.toByte(), 0x00,           //   Collection (Physical)
            0x09, 0x30,                    //     Usage (X)
            0x09, 0x31,                    //     Usage (Y)
            0x09, 0x32,                    //     Usage (Z)
            0x09, 0x35,                    //     Usage (Rz)
            0x15, 0x00,                    //     Logical Minimum (0)
            0x26, 0xFF.toByte(), 0x00,     //     Logical Maximum (255)
            0x75, 0x08,                    //     Report Size (8)
            0x95.toByte(), 0x04,           //     Report Count (4)
            0x81.toByte(), 0x02,           //     Input (Data, Var, Abs)
            0xC0.toByte(),                 //   End Collection
            0x05, 0x01,                    //   Usage Page (Generic Desktop)
            0x09, 0x39,                    //   Usage (Hat Switch)
            0x15, 0x00,                    //   Logical Minimum (0)
            0x25, 0x07,                    //   Logical Maximum (7)
            0x35, 0x00,                    //   Physical Minimum (0)
            0x46, 0x3B, 0x01,              //   Physical Maximum (315)
            0x65, 0x14,                    //   Unit (degrees)
            0x75, 0x04,                    //   Report Size (4)
            0x95.toByte(), 0x01,           //   Report Count (1)
            0x81.toByte(), 0x42,           //   Input (Data, Var, Abs, Null State)
            0x75, 0x04,                    //   Report Size (4) — padding
            0x95.toByte(), 0x01,           //   Report Count (1)
            0x81.toByte(), 0x03,           //   Input (Const)
            0x05, 0x09,                    //   Usage Page (Button)
            0x19, 0x01,                    //   Usage Minimum (Button 1)
            0x29, 0x10,                    //   Usage Maximum (Button 16)
            0x15, 0x00,                    //   Logical Minimum (0)
            0x25, 0x01,                    //   Logical Maximum (1)
            0x75, 0x01,                    //   Report Size (1)
            0x95.toByte(), 0x10,           //   Report Count (16)
            0x81.toByte(), 0x02,           //   Input (Data, Var, Abs)
            0xC0.toByte(),                 // End Collection
        )
    }

    private val executor = Executors.newSingleThreadExecutor()
    private var hid: BluetoothHidDevice? = null
    private var host: BluetoothDevice? = null

    var x = 128; var y = 128; var z = 128; var rz = 128
    var hat = HAT_NEUTRAL
    var buttons = 0

    val connected get() = host != null

    fun start(context: Context) {
        val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null || !adapter.isEnabled) {
            onStatus("Bluetooth is off — turn it on and restart the app")
            return
        }
        val ok = adapter.getProfileProxy(context, object : BluetoothProfile.ServiceListener {
            override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                hid = proxy as BluetoothHidDevice
                register()
            }

            override fun onServiceDisconnected(profile: Int) {
                hid = null
                host = null
                onStatus("HID service lost")
            }
        }, BluetoothProfile.HID_DEVICE)
        if (!ok) onStatus("This phone's Bluetooth stack does not support the HID device role")
    }

    private fun register() {
        val sdp = BluetoothHidDeviceAppSdpSettings(
            "PAD//LINK Controller",
            "PAD//LINK phone gamepad",
            "PAD//LINK",
            BluetoothHidDevice.SUBCLASS2_GAMEPAD,
            DESCRIPTOR,
        )
        val ok = hid?.registerApp(sdp, null, null, executor, object : BluetoothHidDevice.Callback() {
            override fun onAppStatusChanged(pluggedDevice: BluetoothDevice?, registered: Boolean) {
                onStatus(
                    if (registered) "Ready — tap “Make discoverable”, then pair from the TV"
                    else "HID registration rejected by the Bluetooth stack"
                )
            }

            override fun onConnectionStateChanged(device: BluetoothDevice, state: Int) {
                when (state) {
                    BluetoothProfile.STATE_CONNECTED -> {
                        host = device
                        onStatus("🎮 Connected to ${deviceName(device)}")
                        send()
                    }
                    BluetoothProfile.STATE_DISCONNECTED -> {
                        host = null
                        onStatus("Disconnected — pair or reconnect from the TV")
                    }
                }
            }

            override fun onGetReport(device: BluetoothDevice, type: Byte, id: Byte, bufferSize: Int) {
                if (type == BluetoothHidDevice.REPORT_TYPE_INPUT) {
                    hid?.replyReport(device, type, id, report())
                } else {
                    hid?.reportError(device, BluetoothHidDevice.ERROR_RSP_UNSUPPORTED_REQ)
                }
            }

            override fun onSetReport(device: BluetoothDevice, type: Byte, id: Byte, data: ByteArray) {
                hid?.reportError(device, BluetoothHidDevice.ERROR_RSP_SUCCESS)
            }
        }) ?: false
        if (!ok) onStatus("registerApp failed — HID device role unavailable on this phone")
    }

    private fun deviceName(device: BluetoothDevice): String =
        try { device.name ?: device.address } catch (_: SecurityException) { device.address }

    private fun report() = byteArrayOf(
        x.toByte(), y.toByte(), z.toByte(), rz.toByte(),
        (hat and 0x0F).toByte(),
        (buttons and 0xFF).toByte(),
        ((buttons shr 8) and 0xFF).toByte(),
    )

    fun send() {
        val device = host ?: return
        hid?.sendReport(device, 1, report())
    }

    fun press(bit: Int, down: Boolean) {
        buttons = if (down) buttons or (1 shl bit) else buttons and (1 shl bit).inv()
        send()
    }

    fun moveHat(value: Int) {
        hat = value
        send()
    }

    fun stop() {
        hid?.unregisterApp()
    }
}
