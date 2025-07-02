import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
import colors from "colors";
import { HttpsProxyAgent } from "https-proxy-agent";

dotenv.config();

const API_KEY = process.env.API_KEY_2CAPTCHA;
const SITE_KEY = "6LcRmiYoAAAAAEfbmR0ocXJqGpEvq5rw9Cw1kFVt";
const PAGE_URL = "https://faucet.octra.network";
const CLAIM_URL = "https://faucet-api.octra.network/claim";
const BALANCE_URL = "https://faucet-api.octra.network/balance/";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const wallets = fs.readFileSync("wallet.txt", "utf-8").split("\n").map(w => w.trim()).filter(Boolean);
const proxies = fs.existsSync("proxy.txt")
  ? fs.readFileSync("proxy.txt", "utf-8").split("\n").map(p => p.trim()).filter(Boolean)
  : [];

async function getCaptchaToken() {
  try {
    const { data } = await axios.post("http://2captcha.com/in.php", null, {
      params: {
        key: API_KEY,
        method: "userrecaptcha",
        googlekey: SITE_KEY,
        pageurl: PAGE_URL,
        json: 1,
      },
    });

    if (data.status !== 1) {
      console.log("❌ Gagal submit captcha:", data.request);
      return null;
    }

    const captchaId = data.request;
    console.log("⏳ Menunggu token captcha...");

    for (let i = 0; i < 24; i++) {
      await sleep(5000);
      const res = await axios.get("http://2captcha.com/res.php", {
        params: {
          key: API_KEY,
          action: "get",
          id: captchaId,
          json: 1,
        },
      });
      if (res.data.status === 1) return res.data.request;
    }

    console.log("❌ Timeout ambil token captcha");
    return null;
  } catch (err) {
    console.error("❌ Error getCaptcha:", err.message);
    return null;
  }
}

async function claim(wallet, proxy = null) {
  const agent = proxy ? new HttpsProxyAgent(proxy) : null;
  const instance = axios.create({
    httpsAgent: agent,
    proxy: false,
    timeout: 20000,
  });

  const token = await getCaptchaToken();
  if (!token) return false;

  try {
    const res = await instance.post(CLAIM_URL, {
      address: wallet,
      captcha: token,
    });

    if (res.data.success) {
      const balanceRes = await instance.get(BALANCE_URL + wallet);
      const balance = balanceRes.data.balance || "unknown";
      console.log(`✅ ${wallet} berhasil claim. Saldo: ${balance}`.green);
      return true;
    } else {
      console.log(`❌ ${wallet} gagal claim: ${res.data.message}`.red);
      return false;
    }
  } catch (e) {
    console.log(`⚠️  Error claim ${wallet}: ${e.message}`.yellow);
    return false;
  }
}

async function main() {
  for (const wallet of wallets) {
    let success = false;
    let attempts = 0;

    while (!success && attempts < 5) {
      const proxy = proxies.length ? proxies[Math.floor(Math.random() * proxies.length)] : null;
      console.log(`\n🚀 Wallet: ${wallet} | Proxy: ${proxy || "None"}`);
      success = await claim(wallet, proxy);
      if (!success) {
        console.log("🔁 Retry after 10 detik...\n");
        await sleep(10000);
      }
      attempts++;
    }

    await sleep(10000);
  }
}

main();
