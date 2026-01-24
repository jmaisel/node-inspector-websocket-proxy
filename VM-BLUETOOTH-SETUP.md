# VM Bluetooth USB Passthrough Setup Guide

Guide for using a USB Bluetooth dongle in a Linux VM to connect to ESP32 via Web Serial API.

## Prerequisites

- Linux VM (Ubuntu, Mint, etc.)
- USB Bluetooth dongle (e.g., Edimax BT-8500)
- ESP32 with Bluetooth Classic SPP enabled
- BadgerBox Electron app

## Overview

```
USB Bluetooth Dongle → Host OS → VM Passthrough → Linux Guest →
Bluetooth Pairing → Electron App → Web Serial API → ESP32
```

---

## Part 1: VM Setup (Choose Your Platform)

### Option A: VirtualBox

#### 1. Install VirtualBox Extension Pack
```bash
# On host, download from:
# https://www.virtualbox.org/wiki/Downloads
# Install Extension Pack for USB 2.0/3.0 support
```

#### 2. Enable USB Controller in VM Settings
1. Power off VM
2. Settings → USB
3. Enable USB Controller
4. Select "USB 3.0 (xHCI) Controller" or "USB 2.0 (EHCI) Controller"
5. Click OK

#### 3. Add USB Filter (Auto-attach)
1. Settings → USB
2. Click "+" icon to add USB filter
3. Plug in Bluetooth dongle
4. Select "Edimax" or similar from dropdown
5. Click OK
6. Start VM - dongle will auto-attach

**OR Manual Attach (each boot):**
1. Start VM
2. Devices → USB → [Check Edimax adapter]

---

### Option B: VMware Workstation/Player

#### 1. Connect USB Device
1. Plug in Bluetooth dongle
2. Start VM
3. VM → Removable Devices → [Your Bluetooth Adapter] → Connect

#### 2. Keep Connected (Auto-connect)
1. VM → Settings → USB Controller
2. Check "Automatically connect new USB devices"
3. Add device to list for auto-connect

---

### Option C: QEMU/KVM (virt-manager)

#### 1. Via virt-manager GUI
1. Open VM details
2. Add Hardware → USB Host Device
3. Select Bluetooth adapter from list
4. Apply and start VM

#### 2. Via Command Line
```bash
# Find USB device
lsusb
# Example output: Bus 001 Device 005: ID 7392:c611 Edimax

# Edit VM XML
virsh edit <vm-name>

# Add USB device section:
<hostdev mode='subsystem' type='usb'>
  <source>
    <vendor id='0x7392'/>
    <product id='0xc611'/>
  </source>
</hostdev>
```

---

## Part 2: Verify in Linux Guest

### 1. Check USB Device Detected
```bash
# Should show Bluetooth adapter
lsusb

# Example output:
# Bus 001 Device 005: ID 7392:c611 Edimax Technology Co., Ltd
```

### 2. Check Bluetooth Controller
```bash
# Should show hci0 or similar
hciconfig

# Example output:
# hci0:	Type: Primary  Bus: USB
# 	BD Address: XX:XX:XX:XX:XX:XX  ACL MTU: 1021:8  SCO MTU: 64:1
# 	UP RUNNING
```

If not detected:
```bash
# Install Bluetooth packages
sudo apt update
sudo apt install bluez bluez-tools

# Start Bluetooth service
sudo systemctl start bluetooth
sudo systemctl enable bluetooth

# Bring up interface
sudo hciconfig hci0 up
```

---

## Part 3: Pair ESP32

### 1. Put ESP32 in Pairing Mode
- Power on ESP32
- Ensure Bluetooth Classic is enabled
- Device should be discoverable

### 2. Scan for Devices
```bash
bluetoothctl

# In bluetoothctl prompt:
[bluetooth]# power on
[bluetooth]# agent on
[bluetooth]# default-agent
[bluetooth]# scan on

# Wait for ESP32 to appear:
# [NEW] Device XX:XX:XX:XX:XX:XX ESP32-XXXXXX
# Note the MAC address
```

### 3. Pair and Trust
```bash
# In bluetoothctl:
[bluetooth]# pair XX:XX:XX:XX:XX:XX
[bluetooth]# trust XX:XX:XX:XX:XX:XX
[bluetooth]# connect XX:XX:XX:XX:XX:XX

# Should see: Connection successful

# Exit
[bluetooth]# quit
```

### 4. Verify Pairing Persists
```bash
# List paired devices
bluetoothctl devices

# Reconnect if needed
bluetoothctl connect XX:XX:XX:XX:XX:XX
```

---

## Part 4: Test Web Serial API

### 1. Start Electron App
```bash
cd /home/badger/Code/node-inspector-websocket-proxy
npm run electron
```

### 2. Open Bluetooth Panel
- Click **📡 Bluetooth** button in toolbar
- Panel should open

### 3. Connect to ESP32
- Click "Connect to Bluetooth Device"
- System dialog should show your paired ESP32
- Select it and click "Connect"

### 4. Test Communication
- Type a command in the terminal (e.g., `AT`)
- Press Enter
- Should see response from ESP32

---

## Troubleshooting

### USB Device Not Passing Through

**VirtualBox:**
```bash
# On host, check if device is captured
VBoxManage list usbhost

# Verify Extension Pack installed
VBoxManage list extpacks
```

**VMware:**
- Ensure VM is powered off when changing USB settings
- Try USB 2.0 compatibility mode

**QEMU/KVM:**
```bash
# Check USB devices visible to VM
virsh domblklist <vm-name>
```

### Bluetooth Controller Not Detected

```bash
# Check if BlueZ is running
systemctl status bluetooth

# Check kernel modules
lsmod | grep bluetooth

# Load module if needed
sudo modprobe btusb

# Check dmesg for errors
dmesg | grep -i bluetooth
```

### ESP32 Won't Pair

**Check ESP32 is discoverable:**
```bash
# Should show ESP32 in scan
bluetoothctl scan on
```

**Reset Bluetooth on Linux:**
```bash
sudo systemctl restart bluetooth
sudo hciconfig hci0 reset
```

**Check serial profile support:**
```bash
# Should show Serial Port service
sdptool browse XX:XX:XX:XX:XX:XX
```

### Web Serial API Not Seeing Device

**Check browser/Electron version:**
```bash
# In Electron DevTools console:
console.log(navigator.serial)
# Should show SerialPort API object

# Check if Bluetooth Classic supported:
# Should be true for Electron 40
```

**Permission issues:**
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Logout and login for group to take effect
```

**Check device permissions:**
```bash
# Find device
ls -la /dev/rfcomm*
# or
ls -la /dev/ttyUSB*

# Fix permissions if needed
sudo chmod 666 /dev/rfcommX
```

---

## Verification Checklist

- [ ] USB dongle passed through to VM (verified with `lsusb`)
- [ ] Bluetooth controller detected (verified with `hciconfig`)
- [ ] BlueZ service running (verified with `systemctl status bluetooth`)
- [ ] ESP32 paired and trusted (verified with `bluetoothctl devices`)
- [ ] ESP32 connected (verified with `bluetoothctl info XX:XX:XX:XX`)
- [ ] Electron app launches without errors
- [ ] Bluetooth panel opens in app
- [ ] Web Serial API available (check DevTools console)
- [ ] Can select paired ESP32 from system dialog
- [ ] Can send/receive data via terminal

---

## Performance Notes

### USB Passthrough Latency
- USB 2.0 usually works better for Bluetooth than USB 3.0
- Some hypervisors add latency to USB passthrough
- Native hardware access is always better if possible

### Alternative: Direct Host Connection
If VM Bluetooth is problematic, you can:
1. Run Electron app on host OS instead of VM
2. Or use SSH/network connection from VM to host

---

## Quick Reference Commands

```bash
# Check USB
lsusb

# Check Bluetooth
hciconfig
systemctl status bluetooth

# Pair device
bluetoothctl
> scan on
> pair XX:XX:XX:XX:XX:XX
> trust XX:XX:XX:XX:XX:XX
> connect XX:XX:XX:XX:XX:XX

# Run app
cd ~/Code/node-inspector-websocket-proxy
npm run electron
```

---

## Need Help?

If you encounter issues:
1. Check each verification step above
2. Review troubleshooting section
3. Check dmesg and journalctl for errors
4. Verify ESP32 is in SPP mode (not BLE only)
