const { qaPlan } = require("./schemas");

function createPlan(appUrl, description) {
  return qaPlan.parse({
    appUrl,
    description,
    testCases: [
      {
        id: "cart-total-001",
        title: "Add a product and verify the cart total",
        priority: "P0",
        steps: [
          { action: "Open the product catalogue", target: "/", expected: "The product catalogue is visible" },
          { action: "Add the QA Notebook to the cart", target: '[data-testid="add-notebook"]', expected: "A cart confirmation is visible" },
          { action: "Open the cart", target: '[data-testid="cart-link"]', expected: "The cart contains one QA Notebook" },
          { action: "Compare line price and total", target: '[data-testid="cart-total"]', expected: "Total equals the line item price" }
        ]
      },
      {
        id: "checkout-001",
        title: "Complete checkout with valid details",
        priority: "P1",
        steps: [
          { action: "Open checkout", target: '[data-testid="checkout-link"]', expected: "Checkout form is visible" },
          { action: "Submit valid checkout details", target: '[data-testid="place-order"]', expected: "Order confirmation is visible" }
        ]
      }
    ]
  });
}

module.exports = { createPlan };
