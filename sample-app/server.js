const express = require("express");

const app = express();
const port = Number(process.env.PORT || 4173);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} · Meridian</title>
    <style>
      :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #243248; background: #eef2f6; }
      * { box-sizing: border-box; } body { min-height: 100vh; margin: 0; background: #e8edf2; }
      .topbar { display: flex; align-items: center; justify-content: space-between; max-width: 1120px; margin: 0 auto; padding: 22px 28px; } .brand { color: #243248; font-size: 18px; font-weight: 800; letter-spacing: -.04em; text-decoration: none; } .brand-mark { display: inline-grid; width: 25px; height: 25px; margin-right: 8px; place-items: center; border-radius: 7px; color: #fff; background: #2875c9; font-size: 12px; } .topbar nav { display: flex; gap: 24px; } nav a { color: #708098; font-size: 11px; text-decoration: none; } nav a:hover { color: #2875c9; } .sign-in { color: #2875c9; font-size: 11px; font-weight: 800; text-decoration: none; }
      main { max-width: 1120px; margin: 0 auto; padding: 30px 28px 70px; } .auth-layout { display: grid; grid-template-columns: 1fr 430px; gap: 55px; align-items: center; max-width: 970px; margin: 22px auto 0; } .intro { padding: 18px 0; } .eyebrow { margin: 0 0 15px; color: #2875c9; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; } h1 { max-width: 470px; margin: 0 0 17px; color: #243248; font-size: 42px; letter-spacing: -.055em; line-height: 1.04; } .intro-copy { max-width: 410px; color: #6d7d91; font-size: 14px; line-height: 1.7; } .benefits { display: grid; gap: 16px; margin-top: 31px; } .benefit { display: flex; gap: 12px; align-items: flex-start; color: #627289; font-size: 11px; line-height: 1.5; } .benefit-icon { display: grid; width: 27px; height: 27px; flex: none; place-items: center; border-radius: 8px; color: #2875c9; background: #deebf9; font-size: 13px; }
      .card { border: 1px solid #dce4ec; border-radius: 7px; background: #fff; box-shadow: 0 18px 45px #2c48601a; } .card-head { padding: 27px 31px 0; } .card-head h2 { margin: 0 0 7px; font-size: 20px; letter-spacing: -.03em; } .card-head p { margin: 0; color: #8793a3; font-size: 11px; } form { padding: 25px 31px 30px; } .field { margin-bottom: 17px; } label { display: block; margin-bottom: 7px; color: #4d5e73; font-size: 10px; font-weight: 800; } input { width: 100%; border: 1px solid #d5dee8; border-radius: 4px; padding: 12px; color: #243248; background: #fbfcfe; outline: none; font: inherit; font-size: 12px; } input:focus { border-color: #5a9be0; box-shadow: 0 0 0 3px #2875c91c; } .password-hint { margin: -8px 0 18px; color: #929eac; font-size: 10px; } .checkbox { display: flex; gap: 8px; align-items: flex-start; color: #768497; font-size: 10px; line-height: 1.45; } .checkbox input { width: auto; margin-top: 1px; } button, .button { display: inline-block; width: 100%; margin-top: 19px; border: 0; border-radius: 4px; padding: 12px 16px; color: #fff; background: #2875c9; box-shadow: 0 5px 11px #2875c933; cursor: pointer; font: inherit; font-size: 11px; font-weight: 800; text-align: center; text-decoration: none; } button:hover, .button:hover { background: #1d62ad; } .form-error { min-height: 17px; margin: 0; color: #bf4b4b; font-size: 11px; } .card-foot { padding: 16px 31px 22px; border-top: 1px solid #edf1f5; color: #8a96a5; font-size: 10px; text-align: center; } .card-foot a { color: #2875c9; font-weight: 800; text-decoration: none; }
      .success { max-width: 580px; margin: 55px auto; padding: 52px; text-align: center; } .success-icon { display: grid; width: 48px; height: 48px; margin: 0 auto 18px; place-items: center; border-radius: 50%; color: #fff; background: #39a477; font-size: 24px; } .success h1 { margin: 0 auto 12px; font-size: 32px; } .success p { margin: 0 auto 22px; color: #758398; font-size: 13px; line-height: 1.6; }
      footer { max-width: 1120px; margin: 0 auto; padding: 18px 28px; color: #9aa5b2; font-size: 10px; text-align: center; } footer a { color: #738198; text-decoration: none; }
      @media (max-width: 800px) { .auth-layout { grid-template-columns: 1fr; gap: 20px; max-width: 520px; } .intro { text-align: center; } .intro h1, .intro-copy { margin-left: auto; margin-right: auto; } .benefits { text-align: left; } .topbar nav { display: none; } main { padding-top: 12px; } }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function header() {
  return `<header class="topbar"><a class="brand" href="/"><span class="brand-mark">M</span>Meridian</a><nav><a href="/">Overview</a><a href="/">Solutions</a><a href="/">Resources</a></nav><a class="sign-in" href="/register">Sign in</a></header>`;
}

function registrationPage(error = "") {
  return page("Create your account", `${header()}<main><div class="auth-layout"><section class="intro"><p class="eyebrow">Workspace access</p><h1>Everything your team needs to move forward.</h1><p class="intro-copy">Create a Meridian account to keep projects, decisions, and conversations in one calm, connected workspace.</p><div class="benefits"><div class="benefit"><span class="benefit-icon">✓</span><span><strong>One shared workspace</strong><br>Keep the context behind every project in one place.</span></div><div class="benefit"><span class="benefit-icon">↗</span><span><strong>Built for focused teams</strong><br>Simple tools that help good work move faster.</span></div></div></section>
    <section class="card"><div class="card-head"><h2>Create your account</h2><p>Start your 14-day trial. No credit card required.</p></div><form method="post" action="/register" data-testid="registration-form">
      <div class="field"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" placeholder="Alex Chen" required data-testid="name"></div>
      <div class="field"><label for="email">Work email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="alex@company.com" required data-testid="email"></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" required data-testid="password"></div>
      <p class="password-hint">Use at least 8 characters, including a number.</p>
      <div class="field"><label for="confirm-password">Confirm password</label><input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" required data-testid="confirm-password"></div>
      <label class="checkbox"><input type="checkbox" name="terms" required data-testid="terms"><span>I agree to the <a href="/">Terms of Service</a> and <a href="/">Privacy Policy</a>.</span></label>
      <p class="form-error" data-testid="form-error">${escapeHtml(error)}</p><button type="submit" data-testid="create-account">Create account</button>
    </form><div class="card-foot">Already have an account? <a href="/register">Sign in</a></div></section></div></main><footer>© 2026 Meridian &nbsp; · &nbsp; <a href="/">Status</a> &nbsp; · &nbsp; <a href="/">Help center</a></footer>`);
}

app.get("/", (req, res) => res.send(registrationPage()));
app.get("/register", (req, res) => res.send(registrationPage()));

app.post("/register", (req, res) => {
  if (!req.body.name || !req.body.email || !req.body.password || !req.body.confirmPassword) {
    return res.status(400).send(registrationPage("Complete all required fields."));
  }
  if (!req.body.terms) return res.status(400).send(registrationPage("Please accept the terms to continue."));
  // Seeded demonstration defect: confirmation is displayed and collected but never validated.
  res.send(page("Welcome to Meridian", `${header()}<main><section class="card success"><div class="success-icon">✓</div><h1 data-testid="registration-success">Welcome to Meridian</h1><p>Your workspace is ready, ${escapeHtml(req.body.name)}. We sent a confirmation link to ${escapeHtml(req.body.email)}.</p><a class="button" href="/">Go to workspace</a></section></main><footer>© 2026 Meridian &nbsp; · &nbsp; <a href="/">Help center</a></footer>`));
});

if (require.main === module) app.listen(port, () => console.log(`Meridian demo listening at http://127.0.0.1:${port}`));

module.exports = { app };
