Walmart Order Splitter is a Chrome extension that lets you quickly split Walmart cart or order history totals between multiple people. It automatically detects each item, its quantity, and its price (including support for multi-quantity items like bread), and calculates the per-person cost including tax, shipping, and discounts.

✨ Features
Automatic Item Detection – Works on both Walmart cart pages and order history pages.

Multi-Quantity Handling – Correctly processes items with quantities greater than 1.

Fee Inclusion – Splits costs including tax, shipping, and discounts.

Duplicate Prevention – Ensures each item is only counted once even if it appears multiple times in the DOM.

Flexible Assignment – Assign each item to a specific person or everyone in the group.

📸 How It Works
Open your Walmart Cart or Order Details page.

Open the extension popup.

Enter names (comma-separated) for the people splitting the order.

Click Load Cart – the extension will:

Scrape all visible items.

Calculate totals for each person.

Display the breakdown.

🛠️ Technical Overview
The core logic lives in content.js:

DOM Scraping

Detects visible product containers using multiple CSS selectors.

Filters out non-product lines like "Subtotal" or "Sales Tax".

Extracts title, price, quantity, and optional unit information.

De-Duplication

Uses a combined key of product title and price to avoid duplicates.

Calculation

Computes per-item total cost.

Aggregates subtotals, tax, shipping, and discounts.

Popup Communication

Listens for GET_CART messages from popup.js and responds with scraped data.

📂 File Structure
bash
Copy
Edit
walmart-order-splitter/
├── manifest.json        # Chrome extension config
├── popup.html           # Popup UI
├── popup.js             # Handles UI logic & displays results
├── content.js           # Scrapes Walmart pages and sends data to popup
├── icons/               # Extension icons
└── README.md            # This file
🚀 Installation
Clone or download this repository.

Open chrome://extensions in Chrome.

Enable Developer mode.

Click Load unpacked.

Select the extension's folder.

📌 Notes
Works on both cart and order history pages.

Bread and other multi-quantity items are fully supported.

This extension runs locally in your browser – no data is sent anywhere.

Walmart may update its site structure; occasional selector updates may be needed.

📝 License
MIT License.
Feel free to fork, modify, and improve.