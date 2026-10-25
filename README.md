# 🧮 Scientific Calculator

A clean, fast scientific calculator that runs entirely in your browser. Built with plain **HTML, CSS and JavaScript**: no frameworks, no build step, no dependencies.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)

### 🔗 [Live Demo → abhishek360007.github.io/Scientific-Calculator](https://abhishek360007.github.io/Scientific-Calculator/)

---

## ✨ Features

- **Scientific functions**: `sin`, `cos`, `tan` and their inverses, `ln`, `log`, `eˣ`, `10ˣ`, `x²`, `x³`, `xʸ`, `x⁻¹`, `√`, `∛`, `n!`, `|x|`, `%`
- **Constants**: `π`, `e`, plus **Ans** to reuse the last result
- **DEG / RAD** toggle, with exact results for common angles (`sin(180) = 0`, `tan(90)` → error)
- **2nd key** that swaps buttons to their alternate functions
- **Live preview** of the result as you type
- **Smart input**:
  - Implicit multiplication: `2π`, `3(4)`, `2sin(30)`
  - Open brackets are closed automatically when you press `=`
  - After `=`, an operator continues from the answer and a number starts a new calculation
- **History panel**: saved between visits; click any entry to reuse its result
- **Full keyboard support**
- **Light and dark themes**: follows your system setting, with a manual toggle
- **Responsive layout** for desktop and mobile

## 🚀 Getting Started

No installation needed.

```bash
git clone https://github.com/Abhishek360007/Scientific-Calculator.git
cd Scientific-Calculator
```

Then open `index.html` in any modern browser.

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `0`–`9`, `.` | Numbers |
| `+` `-` `*` `/` `^` | Add, subtract, multiply, divide, power |
| `(` `)` | Brackets |
| `!` `%` | Factorial, percent |
| `Enter` or `=` | Calculate |
| `Backspace` | Delete last input |
| `Esc` or `Delete` | Clear all |
| `s` `c` `t` | sin, cos, tan |
| `l` `g` | ln, log |
| `r` | Square root |
| `p` `e` | π, e |

## 🧠 How It Works

The calculator does **not** use JavaScript's `eval()`. Instead, expressions go through a small custom math engine:

1. **Tokenizer**: turns the expression (e.g. `2sin(30)+√(16)`) into numbers, operators, functions and constants.
2. **Recursive-descent parser**: evaluates the tokens with correct operator precedence:

   | Precedence | Operators |
   | --- | --- |
   | Highest | `!` `%` `²` `³` `⁻¹` (postfix) |
   | | `^` (right-associative, so `2^3^2 = 512`) |
   | | unary `−` (so `−2² = −4`) |
   | | `×` `÷` and implicit multiplication |
   | Lowest | `+` `−` |

3. **Formatting**: results are rounded to 12 significant digits to hide floating-point noise (`0.1 + 0.2` shows `0.3`). Very large or very small numbers switch to scientific notation.

Errors such as division by zero, `√(−1)` or `ln(0)` show a clear message instead of `NaN` or `Infinity`. Factorials of non-integers (e.g. `0.5!`) are computed with the Gamma function.

## 📁 Project Structure

```
Scientific-Calculator/
├── index.html   # Page layout
├── style.css    # Styling, light/dark themes, responsive layout
├── script.js    # Math engine, keypad, keyboard input, history
└── README.md
```

## 👤 Author

**Abhishek Raj**: [@Abhishek360007](https://github.com/Abhishek360007)
