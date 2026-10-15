const express = require("express");

const app = express();
const port = Number(process.env.PORT || 4173);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const products = [
  { id: "notebook", name: "QA Notebook", price: 12.5 },
  { id: "mug", name: "Bug Hunter Mug", price: 8 },
  { id: "sticker", name: "Ship-It Sticker", price: 2.5 }
];

function money(value) {
  return `$${value.toFixed(2)}`;
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 760px; margin: 3rem auto; padding: 0 1rem; color: #172033; }
      header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; margin-bottom: 2rem; }
      a, button { color: #fff; background: #2457d6; border: 0; border-radius: 5px; padding: .65rem .9rem; text-decoration: none; cursor: pointer; }
      .product, .cart-line { display: flex; justify-content: space-between; align-items: center; border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: .75rem 0; }
      .price { font-weight: 700; margin-right: 1rem; }
      .notice { background: #fff4cc; border: 1px solid #e8ca5b; padding: .8rem; border-radius: 5px; }
      .total { font-size: 1.3rem; font-weight: 700; text-align: right; margin: 1.5rem 0; }
      label { display: block; margin: .8rem 0 .25rem; }
      input { box-sizing: border-box; width: 100%; padding: .65rem; border: 1px solid #aaa; border-radius: 4px; }
      .error { color: #a30000; min-height: 1.2rem; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function header(cartCount) {
  return `<header><a href="/">BugShop</a><a href="/cart" data-testid="cart-link">Cart (${cartCount})</a></header>`;
}

app.get("/", (req, res) => {
  const productsHtml = products.map((product) => `
    <article class="product" data-testid="product-${product.id}">
      <div><h2>${product.name}</h2><span class="price">${money(product.price)}</span></div>
      <form method="post" action="/cart/add">
        <input type="hidden" name="productId" value="${product.id}">
        <button type="submit" data-testid="add-${product.id}">Add to cart</button>
      </form>
    </article>`).join("");
  res.send(page("BugShop", `${header(0)}<main><h1>Small team supplies</h1><p>Buy practical tools for shipping reliable software.</p>${productsHtml}</main>`));
});

app.post("/cart/add", (req, res) => {
  const product = products.find((item) => item.id === req.body.productId);
  if (!product) return res.status(400).send("Unknown product");
  res.redirect(`/cart?added=${encodeURIComponent(product.name)}`);
});

app.get("/cart", (req, res) => {
  const added = req.query.added ? `<p class="notice" data-testid="added-notice">${req.query.added} added to cart.</p>` : "";
  const product = products[0];
  // Seeded defect for the Stage-2 demonstration: the displayed total is 1.00
  // higher than the product price.
  const displayedTotal = product.price + 1;
  res.send(page("Your cart", `${header(1)}<main><h1>Your cart</h1>${added}
    <div class="cart-line" data-testid="cart-line"><span>${product.name} × 1</span><span data-testid="line-price">${money(product.price)}</span></div>
    <div class="total" data-testid="cart-total">Total: ${money(displayedTotal)}</div>
    <a href="/checkout" data-testid="checkout-link">Continue to checkout</a>
  </main>`));
});

app.get("/checkout", (req, res) => {
  res.send(page("Checkout", `${header(1)}<main><h1>Checkout</h1>
    <form method="post" action="/checkout" data-testid="checkout-form">
      <label for="email">Email</label><input id="email" name="email" type="email" required data-testid="email">
      <label for="address">Shipping address</label><input id="address" name="address" required data-testid="address">
      <p class="error" data-testid="form-error"></p><button type="submit" data-testid="place-order">Place order</button>
    </form>
  </main>`));
});

app.post("/checkout", (req, res) => {
  if (!req.body.email || !req.body.address) return res.status(400).send("Missing checkout details");
  res.send(page("Order complete", `${header(0)}<main><h1 data-testid="order-success">Order placed</h1><p>Thanks for testing BugShop.</p></main>`));
});

if (require.main === module) {
  app.listen(port, () => console.log(`BugShop listening at http://127.0.0.1:${port}`));
}

module.exports = { app, products };
