# AirWatch v2.1 Hardware Schematic

This document maps the connections used by `AirWatch_v2_1.ino` and shows the recommended protected driver circuits for the fan and buzzer. The sketch defines the GPIO assignments, but it does not identify exact display breakout, ESP32-S3 board, fan, buzzer, or supply models. Confirm their pin labels and voltage/current ratings before wiring.

## Functional overview

```text
                   +-----------------------+
                   |      ESP32-S3         |
                   |                       |
  SPI bus ---------+--> ILI9341 TFT        |
  SPI bus ---------+--> XPT2046 touch      |
  I2C SDA/SCL -----+--> SCD41 CO2 sensor   |
  GPIO18 ----------+--> WS2812/NeoPixel    |
  GPIO1  <---------+----- Power button     |
  GPIO2  <---------+----- Mute button       |
  GPIO6  ----------+--> MOSFET --> DC fan  |
  GPIO7  ----------+--> MOSFET --> buzzer  |
                   +-----------------------+
```

## Pin assignment table

| ESP32-S3 GPIO | Connects to | Notes |
| --- | --- | --- |
| GPIO4 | SCD41 SDA | I2C data |
| GPIO5 | SCD41 SCL | I2C clock |
| GPIO10 | ILI9341 CS | TFT chip select |
| GPIO14 | ILI9341 D/C | TFT data/command |
| GPIO21 | ILI9341 RESET | TFT reset |
| GPIO16 | XPT2046 T_CS | Touch controller chip select |
| GPIO17 | SD CS (reserved) | The sketch sets this high to deselect SPI; it does not initialize an SD card. |
| GPIO12 | TFT/touch SCK | Shared SPI clock |
| GPIO11 | TFT/touch MOSI | Shared SPI controller output |
| GPIO13 | TFT/touch MISO | Shared SPI controller input |
| GPIO1 | Power button | Button from GPIO1 to GND; configured with `INPUT_PULLUP`. |
| GPIO2 | Mute button | Button from GPIO2 to GND; configured with `INPUT_PULLUP`. |
| GPIO6 | Fan MOSFET gate driver | Do not connect the fan directly to this pin. |
| GPIO7 | Buzzer MOSFET gate driver | Do not connect a high-current buzzer directly to this pin. |
| GPIO18 | NeoPixel data input | Use a 3.3 V-compatible pixel input or a 3.3 V-to-5 V logic buffer if needed. |

## Main wiring schematic

```text
                         ESP32-S3 development board
                    +--------------------------------+
                    |                                |
          3V3 ------+---- SCD41 VDD                  |
          GND ------+---- SCD41 GND                  |
          GPIO4 ----+---- SCD41 SDA                  |
          GPIO5 ----+---- SCD41 SCL                  |
                    |                                |
          GPIO12 ---+---- TFT SCK ---- Touch T_CLK   |
          GPIO11 ---+---- TFT MOSI --- Touch T_DIN   |
          GPIO13 <--+---- TFT MISO --- Touch T_DO    |
          GPIO10 ---+---- TFT CS                    |
          GPIO14 ---+---- TFT D/C                   |
          GPIO21 ---+---- TFT RESET                 |
          GPIO16 ---+---- Touch T_CS                |
          GPIO17 ---+---- SD CS (unused/reserved)   |
                    |                                |
          GPIO1 ----+---- Push button ---- GND       |
          GPIO2 ----+---- Push button ---- GND       |
                    |                                |
          GPIO18 ---+---- NeoPixel DIN               |
          GND ------+---- NeoPixel GND               |
          +5V* -----+---- NeoPixel VDD               |
                    |                                |
          GPIO6 ----+---- Fan MOSFET gate circuit    |
          GPIO7 ----+---- Buzzer MOSFET gate circuit |
          GND ------+---- Common ground              |
                    +--------------------------------+

  *Use the voltage required by the actual NeoPixel and its board. Do not feed
   5 V into ESP32 GPIO or into a 3.3 V-only sensor/display input.
```

The TFT and touch controller share the SPI clock, MOSI, and MISO lines. Each device needs its own chip select. Connect the breakout pins by their labels, not by assumed header order. If a breakout is powered at 5 V, verify that its SPI outputs and control inputs are safe for the ESP32-S3's 3.3 V GPIO.

## Fan driver (GPIO6)

Use a logic-level N-channel MOSFET as a low-side switch. For a small fan, an **IRLML6344** is one candidate: its datasheet specifies maximum on-resistance at a 2.5 V gate drive. Confirm the fan's startup/stall current and MOSFET thermal limits before selecting it for the actual load.

```text
             +Vfan ----+-------------------------- Fan +
                       |                            Fan
                       +---- D1 flyback diode ----- Fan - ---- Q1 Drain
                             K                A                 (pin 3)
                                                               Q1 IRLML6344
ESP32 GPIO6 ---- R1 100 ohm ----+---- Q1 Gate (pin 1)  Q1 Source (pin 2) ---- GND
                                |
                           R2 10 kohm
                                |
GND ---------------------------+-------------------------------------------+
External fan supply (-) -------+  (common ground with ESP32)
```

For D1, the **cathode (K, stripe) goes to +Vfan** and the **anode (A) goes to the fan negative/MOSFET drain node**. Select a diode with reverse-voltage rating above the fan supply and current rating suitable for the fan's inductive current (including startup behavior). A Schottky such as SS34 may be appropriate for some small fans, but check its ratings against the actual fan. Keep the diode and MOSFET close to the load wiring. A 100 nF ceramic capacitor across a brushed DC motor's terminals can help reduce electrical noise.

## Buzzer driver (GPIO7)

Use a second MOSFET and separate gate resistors. An inductive/magnetic buzzer needs a flyback diode. A piezo buzzer is usually capacitive and generally does not use a flyback diode; follow the buzzer manufacturer's circuit guidance.

```text
             External buzzer supply (+Vbuzz)
                       |
                       +--------------------------- Buzzer +
                                                   Buzzer -
                                                       |
                                                       +---- Q2 Drain (pin 3)
                                                            Q2 IRLML6344
ESP32 GPIO7 ---- R3 100 ohm ----+---- Q2 Gate (pin 1)      Q2 Source (pin 2) --- GND
                                |
                           R4 10 kohm
                                |
GND ---------------------------+-------------------------------------------+
External buzzer supply (-) ----+  (common ground with ESP32)

For a magnetic buzzer only, add D2 across the buzzer:
  D2 cathode (stripe) -> +Vbuzz
  D2 anode            -> buzzer negative / Q2 drain
```

The 100 ohm resistors limit brief gate-charging current and the 10 kohm resistors hold each MOSFET off while the ESP32 boots or the GPIO is floating. Use one resistor pair per MOSFET. IRLML6344 SOT-23 pin assignment is gate=1, source=2, drain=3; verify the exact package pinout from the part datasheet before soldering.

## Power and wiring notes

- Power the ESP32-S3 board through its intended USB/VIN input. Power the fan and buzzer from supplies that match their labels and can provide their startup current. Do not draw motor current from the ESP32 3.3 V pin.
- Join external supply negative, ESP32 GND, MOSFET sources, and sensor/display grounds at a common ground. Route fan current back to the supply rather than through thin ESP32 ground paths.
- Put bulk decoupling near the fan supply/load wiring (for example, 100–470 uF rated above the supply voltage, plus a 100 nF ceramic). Choose values and voltage ratings for the actual supply and load.
- The SCD41 is an I2C device. Use 3.3 V logic. Check the sensor breakout for built-in I2C pull-ups; avoid duplicate pull-ups that make the bus too strong. Do not use a 5 V I2C pull-up on ESP32 GPIO.
- The ESP32, SCD41, TFT/touch, and NeoPixel need compatible logic levels. A 5 V supply rail does not make ESP32 GPIO 5 V tolerant.
- Add an inline fuse sized for the fan branch and wiring. Keep polarity correct and insulate exposed supply and motor connections.

## Parts list (starting point)

| Ref | Part | Starting value/type | Selection note |
| --- | --- | --- | --- |
| Q1, Q2 | N-channel logic-level MOSFET | IRLML6344 candidate | Check supply voltage, stall current, package thermal limits, and pinout. Use a suitably rated larger package if needed. |
| R1, R3 | Gate series resistors | 100 ohm | One per MOSFET gate. |
| R2, R4 | Gate pulldown resistors | 10 kohm | Gate to source/GND, one per MOSFET. |
| D1 | Fan flyback diode | Rated for fan current and supply voltage | Cathode to +Vfan; choose using fan startup/stall current. |
| D2 | Buzzer flyback diode | Only for magnetic/inductive buzzer | Cathode to +Vbuzz; confirm buzzer type. |
| C1 | Fan supply bulk capacitor | 100–470 uF, voltage rating above supply | Place near fan/MOSFET supply wiring. |
| C2 | Fan noise capacitor | 100 nF ceramic | Place across brushed motor terminals if applicable. |

## Details needed to finalize component ratings

Before treating this as a build-ready bill of materials, identify:

1. ESP32-S3 board/module model.
2. TFT/touch breakout model and its supply/logic specifications.
3. Fan voltage and rated plus startup/stall current.
4. Buzzer type (piezo or magnetic), voltage, and current.
5. NeoPixel model and supply voltage.

The firmware pin map is taken from `AirWatch_v2_1.ino`. This is a connection schematic for the currently identified modules, not a PCB layout or a substitute for checking the actual board pinout and component datasheets.
