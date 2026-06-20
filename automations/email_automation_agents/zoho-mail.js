const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ACCOUNT_ID = process.env.ZOHO_ACCOUNT_ID;

/**
 * Gets a new access token using the refresh token
 */
async function getAccessToken() {
  const url = `https://accounts.zoho.in/oauth/v2/token?grant_type=refresh_token&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}`;

  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();

  if (data.error) {
    throw new Error(`Failed to refresh token: ${data.error}`);
  }

  return data.access_token;
}

/**
 * Sends an email using Zoho Mail API
 */
export async function sendEmail({ to, subject, content }) {
  try {
    const accessToken = await getAccessToken();
    const url = `https://mail.zoho.in/api/accounts/${ZOHO_ACCOUNT_ID}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromAddress: "team@aczen.in",
        toAddress: to,
        subject: subject,
        content: content
      })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Quick test if run directly
if (process.argv[1] && process.argv[1].endsWith('zoho-mail.js')) {
  sendEmail({
    to: "team@aczen.in",
    subject: "Test email from teja for email automation ",
    content: "Test email from teja for email automation"
  }).then(res => {
    console.log("Email sent response:", res);
  }).catch(console.error);
}
