import { Link } from 'react-router-dom';

const css = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

.ft-landing{
  --green-700:#1a6e50;
  --green-600:#22896a;
  --green-500:#2ba57e;
  --green-400:#3dbd93;
  --green-100:#dff2ea;
  --green-50:#eef9f4;
  --navy-800:#1e2f4a;
  --navy-900:#16233a;
  --ink:#0f1720;
  --text-2:#4a5c52;
  --text-3:#8aa094;
  --mint-bg:#e8f4ee;
  --white:#fff;
  --amber:#f0b429;
  --radius:12px;
  font-family:'Noto Sans Thai','Plus Jakarta Sans',sans-serif;
  color:var(--ink);background:var(--white);line-height:1.65;
  -webkit-font-smoothing:antialiased;
}
.ft-landing *{margin:0;padding:0;box-sizing:border-box}
.ft-landing button{font-family:inherit;cursor:pointer}
.ft-landing a{text-decoration:none;color:inherit}
.ft-landing img{max-width:100%;display:block}

/* ============ NAV ============ */
.ft-landing .nav{
  position:sticky;top:0;z-index:100;
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 48px;background:rgba(255,255,255,.94);
  backdrop-filter:blur(10px);border-bottom:1px solid rgba(0,0,0,.06)
}
.ft-landing .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:19px;letter-spacing:-.3px}
.ft-landing .logo svg{flex-shrink:0}
.ft-landing .nav-links{display:flex;gap:30px}
.ft-landing .nav-links a{font-size:14.5px;font-weight:500;color:var(--text-2);transition:color .18s}
.ft-landing .nav-links a:hover{color:var(--green-600)}
.ft-landing .nav-actions{display:flex;gap:10px}
.ft-landing .btn{border:none;border-radius:10px;font-weight:600;font-size:14px;padding:10px 20px;transition:all .18s}
.ft-landing .btn-outline{background:#fff;border:1.5px solid #d9e3dd;color:var(--ink)}
.ft-landing .btn-outline:hover{border-color:var(--green-500);color:var(--green-600)}
.ft-landing .btn-solid{background:var(--green-600);color:#fff}
.ft-landing .btn-solid:hover{background:var(--green-500);transform:translateY(-1px);box-shadow:0 6px 16px rgba(43,165,126,.28)}

/* ============ HERO ============ */
.ft-landing .hero{max-width:1140px;margin:0 auto;padding:76px 48px 84px;display:grid;grid-template-columns:1.05fr .95fr;gap:64px;align-items:center}
.ft-landing .hero h1{font-size:52px;line-height:1.14;font-weight:800;letter-spacing:-1.2px;margin-bottom:8px}
.ft-landing .hero h1 .th{color:var(--ink)}
.ft-landing .hero h1 .accent{color:var(--green-600)}
.ft-landing .hero h1 .en{color:var(--green-500)}
.ft-landing .hero p{font-size:16px;color:var(--text-2);margin:18px 0 30px;max-width:460px}
.ft-landing .hero-cta{display:flex;gap:12px;align-items:center}
.ft-landing .btn-lg{padding:14px 28px;font-size:15px;font-weight:700;border-radius:12px}
.ft-landing .btn-hero{background:var(--green-600);color:#fff;border:none;box-shadow:0 8px 20px rgba(34,137,106,.3)}
.ft-landing .btn-hero:hover{background:var(--green-500);transform:translateY(-2px)}
.ft-landing .btn-hero2{background:#fff;border:1.5px solid #d9e3dd;color:var(--ink)}
.ft-landing .btn-hero2:hover{border-color:var(--green-500);color:var(--green-600)}

/* invoice mockup card */
.ft-landing .mock-wrap{position:relative;display:flex;justify-content:center}
.ft-landing .mock{
  width:360px;background:#fff;border-radius:18px;overflow:hidden;
  box-shadow:0 24px 64px rgba(22,35,58,.16),0 4px 12px rgba(22,35,58,.06);
  transform:rotate(3deg);border:1px solid rgba(0,0,0,.05)
}
.ft-landing .mock-head{background:var(--green-600);padding:14px 18px;display:flex;align-items:center;justify-content:space-between}
.ft-landing .mock-brand{display:flex;align-items:center;gap:7px;color:#fff;font-weight:700;font-size:14px}
.ft-landing .mock-badge{background:var(--amber);color:#5c4405;font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;transform:rotate(4deg)}
.ft-landing .mock-body{padding:20px 18px}
.ft-landing .mock-label{font-size:11.5px;color:var(--text-3);margin-bottom:2px}
.ft-landing .mock-total{font-size:32px;font-weight:800;letter-spacing:-.8px;margin-bottom:16px}
.ft-landing .mock-rows{display:flex;flex-direction:column;gap:9px;margin-bottom:16px}
.ft-landing .mock-row{display:flex;align-items:center;gap:10px}
.ft-landing .mr-dot{width:12px;height:12px;border-radius:4px;flex-shrink:0}
.ft-landing .mr-bar{flex:1;height:8px;border-radius:4px;background:#eef1ef}
.ft-landing .mr-amt{font-size:12.5px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.ft-landing .mock-foot{margin:0 18px 18px;background:var(--green-50);border:1px solid var(--green-100);border-radius:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between}
.ft-landing .mf-left{display:flex;align-items:center;gap:10px}
.ft-landing .mf-qr{width:36px;height:36px;border-radius:8px;background:#fff;border:1px solid var(--green-100);display:grid;place-items:center}
.ft-landing .mf-txt strong{display:block;font-size:12.5px;color:var(--green-700)}
.ft-landing .mf-txt span{font-size:11px;color:var(--text-3)}
.ft-landing .mf-check{width:30px;height:30px;border-radius:50%;background:var(--green-500);display:grid;place-items:center}
.ft-landing .spark{position:absolute;font-size:20px;color:var(--amber)}
.ft-landing .spark.s1{top:-6px;right:44px}
.ft-landing .spark.s2{bottom:56px;left:-4px;color:#e8735a;font-size:15px}

/* ============ FEATURE STRIP ============ */
.ft-landing .strip{border-top:1px solid rgba(0,0,0,.06);border-bottom:1px solid rgba(0,0,0,.06);background:#fff}
.ft-landing .strip-in{max-width:1140px;margin:0 auto;padding:22px 48px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.ft-landing .strip-item{display:flex;gap:12px;align-items:flex-start}
.ft-landing .strip-ic{width:38px;height:38px;border-radius:10px;background:var(--green-50);display:grid;place-items:center;flex-shrink:0}
.ft-landing .strip-item strong{display:block;font-size:14px;font-weight:700}
.ft-landing .strip-item span{font-size:12.5px;color:var(--text-3)}

/* ============ SECTIONS ============ */
.ft-landing .sec{padding:84px 48px}
.ft-landing .sec.mint{background:var(--mint-bg)}
.ft-landing .sec-in{max-width:1140px;margin:0 auto}
.ft-landing .sec-title{font-size:34px;font-weight:800;letter-spacing:-.8px;margin-bottom:10px}
.ft-landing .sec-sub{font-size:15.5px;color:var(--text-2);max-width:560px;margin-bottom:44px}

/* channels */
.ft-landing .pay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.ft-landing .pay-card{background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:16px;padding:26px;transition:all .22s}
.ft-landing .pay-card:hover{transform:translateY(-4px);box-shadow:0 14px 36px rgba(34,137,106,.12);border-color:var(--green-400)}
.ft-landing .pay-card.dark{background:var(--green-600);border-color:var(--green-600)}
.ft-landing .pay-ic{width:44px;height:44px;border-radius:12px;background:var(--green-50);display:grid;place-items:center;margin-bottom:16px}
.ft-landing .pay-card.dark .pay-ic{background:rgba(255,255,255,.16)}
.ft-landing .pay-name{font-size:16px;font-weight:700;margin-bottom:6px}
.ft-landing .pay-card.dark .pay-name{color:#fff}
.ft-landing .pay-desc{font-size:13.5px;color:var(--text-3);line-height:1.6}
.ft-landing .pay-card.dark .pay-desc{color:rgba(255,255,255,.75)}
.ft-landing .pay-tag{display:inline-block;margin-top:14px;font-size:11px;font-weight:700;padding:4px 10px;border-radius:7px;background:var(--green-50);color:var(--green-700)}
.ft-landing .pay-card.dark .pay-tag{background:rgba(255,255,255,.18);color:#fff}

/* steps */
.ft-landing .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.ft-landing .step{background:#fff;border-radius:16px;padding:30px;position:relative;border:1px solid rgba(0,0,0,.06)}
.ft-landing .step-n{
  width:34px;height:34px;border-radius:10px;display:grid;place-items:center;
  font-weight:800;font-size:15px;margin-bottom:16px;color:#fff
}
.ft-landing .step:nth-child(1) .step-n{background:#e8735a}
.ft-landing .step:nth-child(2) .step-n{background:var(--amber);color:#5c4405}
.ft-landing .step:nth-child(3) .step-n{background:var(--green-500)}
.ft-landing .step strong{display:block;font-size:16.5px;font-weight:700;margin-bottom:6px}
.ft-landing .step p{font-size:13.5px;color:var(--text-3)}

/* everything section */
.ft-landing .feat-hero{background:var(--green-600);border-radius:18px;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.ft-landing .fh-left strong{display:block;color:#fff;font-size:19px;font-weight:800;margin-bottom:4px}
.ft-landing .fh-left span{color:rgba(255,255,255,.72);font-size:13.5px}
.ft-landing .fh-qr{width:72px;height:72px;border-radius:14px;background:rgba(255,255,255,.14);display:grid;place-items:center;flex-shrink:0}
.ft-landing .feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.ft-landing .feat-card{background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:16px;padding:24px}
.ft-landing .fc-ic{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;margin-bottom:14px}
.ft-landing .fc-ic.red{background:#fdeae6}
.ft-landing .fc-ic.blue{background:#e6f0fb}
.ft-landing .fc-ic.amber{background:#fdf3dc}
.ft-landing .feat-card strong{display:block;font-size:15px;font-weight:700;margin-bottom:5px}
.ft-landing .feat-card p{font-size:13px;color:var(--text-3)}

/* promo banner */
.ft-landing .promo{
  max-width:720px;margin:0 auto 36px;position:relative;
  background:var(--navy-800);border-radius:20px;padding:30px 36px;
  display:flex;align-items:center;justify-content:space-between;gap:24px;
  overflow:hidden;text-align:left
}
.ft-landing .promo::before{
  content:'';position:absolute;right:-40px;top:-40px;width:200px;height:200px;
  background:radial-gradient(circle,rgba(43,165,126,.35) 0%,transparent 70%)
}
.ft-landing .promo-burst{
  position:absolute;left:-18px;top:-18px;width:110px;height:110px;
  animation:ft-pulse 1.6s ease-in-out infinite
}
@keyframes ft-pulse{0%,100%{transform:scale(1) rotate(-12deg)}50%{transform:scale(1.08) rotate(-12deg)}}
.ft-landing .promo-left{position:relative;z-index:2;padding-left:56px}
.ft-landing .promo-tag{
  display:inline-block;background:var(--amber);color:#5c4405;
  font-size:11px;font-weight:800;padding:4px 12px;border-radius:100px;
  letter-spacing:.5px;margin-bottom:8px;transform:rotate(-2deg)
}
.ft-landing .promo-title{color:#fff;font-size:24px;font-weight:800;letter-spacing:-.4px;line-height:1.25}
.ft-landing .promo-title .strike{
  color:rgba(255,255,255,.45);text-decoration:line-through;
  font-size:18px;font-weight:600;margin-right:8px
}
.ft-landing .promo-title .hot{color:#ffd166;font-size:32px}
.ft-landing .promo-sub{color:rgba(255,255,255,.65);font-size:13px;margin-top:6px}
.ft-landing .promo-right{position:relative;z-index:2;flex-shrink:0}
.ft-landing .promo-timer{
  font-family:'Plus Jakarta Sans',monospace;color:#fff;font-size:12px;
  text-align:center;margin-bottom:10px;opacity:.75
}
.ft-landing .btn-promo{
  background:var(--amber);color:#5c4405;border:none;border-radius:12px;
  font-weight:800;font-size:15px;padding:14px 28px;white-space:nowrap;
  box-shadow:0 8px 22px rgba(240,180,41,.4);transition:all .18s
}
.ft-landing .btn-promo:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 12px 28px rgba(240,180,41,.5)}

/* pricing */
.ft-landing .price-wrap{display:grid;grid-template-columns:repeat(2,minmax(0,300px));gap:18px;justify-content:center}
.ft-landing .price{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:30px;position:relative;text-align:left}
.ft-landing .price.pro{border:2px solid var(--green-500)}
.ft-landing .price-pop{
  position:absolute;top:-12px;left:50%;transform:translateX(-50%);
  background:var(--green-500);color:#fff;font-size:11px;font-weight:700;
  padding:4px 14px;border-radius:100px;white-space:nowrap
}
.ft-landing .price h3{font-size:14px;font-weight:700;color:var(--text-3);margin-bottom:6px}
.ft-landing .price-amt{font-size:38px;font-weight:800;letter-spacing:-1px}
.ft-landing .price-amt span{font-size:14px;color:var(--text-3);font-weight:500}
.ft-landing .price ul{list-style:none;margin:22px 0;display:flex;flex-direction:column;gap:10px}
.ft-landing .price li{display:flex;gap:9px;font-size:13.5px;color:var(--text-2);align-items:center}
.ft-landing .price li svg{flex-shrink:0}
.ft-landing .price .btn{width:100%;padding:12px}

/* cta */
.ft-landing .cta{background:var(--green-600);margin:0 48px 84px;border-radius:22px;padding:60px;text-align:center}
.ft-landing .cta-in{max-width:1140px;margin:0 auto}
.ft-landing .cta h2{color:#fff;font-size:36px;font-weight:800;letter-spacing:-.8px;margin-bottom:10px}
.ft-landing .cta p{color:rgba(255,255,255,.75);font-size:15px;margin-bottom:30px}
.ft-landing .btn-cta{background:#fff;color:var(--green-700);font-weight:700;padding:14px 32px;border-radius:12px;border:none;font-size:15px}
.ft-landing .btn-cta:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.18)}

/* footer */
.ft-landing footer{border-top:1px solid rgba(0,0,0,.06);padding:32px 48px}
.ft-landing .foot-in{max-width:1140px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
.ft-landing .foot-links{display:flex;gap:22px}
.ft-landing .foot-links a{font-size:13px;color:var(--text-3)}
.ft-landing .foot-links a:hover{color:var(--green-600)}
.ft-landing .foot-copy{font-size:13px;color:var(--text-3)}

/* responsive */
@media(max-width:960px){
  .ft-landing .nav{padding:12px 20px}
  .ft-landing .nav-links{display:none}
  .ft-landing .hero{grid-template-columns:1fr;padding:48px 20px;gap:44px}
  .ft-landing .hero h1{font-size:38px}
  .ft-landing .strip-in{grid-template-columns:repeat(2,1fr);padding:20px}
  .ft-landing .sec{padding:56px 20px}
  .ft-landing .pay-grid,.ft-landing .steps,.ft-landing .feat-grid{grid-template-columns:1fr}
  .ft-landing .price-wrap{grid-template-columns:1fr}
  .ft-landing .promo{flex-direction:column;text-align:center;padding:60px 24px 28px}
  .ft-landing .promo-left{padding-left:0}
  .ft-landing .promo-burst{left:50%;top:-28px;width:88px;height:88px;animation:ft-pulse-m 1.6s ease-in-out infinite}
  .ft-landing .cta{margin:0 20px 56px;padding:40px 24px}
  .ft-landing .cta h2{font-size:27px}
  .ft-landing .foot-in{flex-direction:column;gap:14px}
}
@keyframes ft-pulse-m{0%,100%{transform:translateX(-50%) scale(1) rotate(-12deg)}50%{transform:translateX(-50%) scale(1.08) rotate(-12deg)}}
`;

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="6" fill="#eef9f4" />
    <path d="M4.5 7l1.8 1.8L9.8 5.4" stroke="#22896a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LogoMark = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
    <path d="M7.5 16.5C7.5 19.5 9.9 22 13 22s5.5-2.5 5.5-5.5S16.1 11 13 11" stroke="#1e2f4a" strokeWidth="3" strokeLinecap="round" />
    <path d="M18.5 9.5C18.5 6.5 16.1 4 13 4S7.5 6.5 7.5 9.5 9.9 15 13 15" stroke="#2ba57e" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export default function LandingPage() {
  return (
    <div className="ft-landing">
      <style>{css}</style>

      {/* NAV */}
      <nav className="nav">
        <Link to="/" className="logo">
          <LogoMark />
          FinTrust
        </Link>
        <div className="nav-links">
          <a href="#features">ฟีเจอร์</a>
          <a href="#channels">ช่องทางรับเงิน</a>
          <a href="#pricing">ราคา</a>
        </div>
        <div className="nav-actions">
          <Link to="/login"><button className="btn btn-outline">เข้าสู่ระบบ</button></Link>
          <Link to="/register"><button className="btn btn-solid">เริ่มต้นใช้งานฟรี</button></Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div>
          <h1>
            <span className="th">ส่งใบแจ้งหนี้.</span> <span className="accent">รับเงิน.</span><br />
            <span className="en">Get paid.</span>
          </h1>
          <p>FinTrust คือระบบใบแจ้งหนี้สำหรับ SME ไทย: PromptPay QR พร้อมใช้งาน, PDF ภาษาไทยมาตรฐาน, VAT 7% และ WHT ในตัว ไม่ใช่แค่นั้นมาจาก Western SaaS</p>
          <div className="hero-cta">
            <Link to="/register"><button className="btn btn-lg btn-hero">เริ่มต้นใช้งานฟรี</button></Link>
            <a href="#features"><button className="btn btn-lg btn-hero2">ดูฟีเจอร์</button></a>
          </div>
        </div>

        <div className="mock-wrap">
          <span className="spark s1">✦</span>
          <span className="spark s2">✦</span>
          <div className="mock">
            <div className="mock-head">
              <div className="mock-brand">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4.5 10c0 1.9 1.5 3.5 3.5 3.5s3.5-1.6 3.5-3.5S9.9 6.5 8 6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  <path d="M11.5 6c0-1.9-1.5-3.5-3.5-3.5S4.5 4.1 4.5 6 6.1 9.5 8 9.5" stroke="#bfe9d9" strokeWidth="2" strokeLinecap="round" />
                </svg>
                FinTrust
              </div>
              <span className="mock-badge">Waiting</span>
            </div>
            <div className="mock-body">
              <div className="mock-label">ยอดรวม Total</div>
              <div className="mock-total">฿72,800</div>
              <div className="mock-rows">
                <div className="mock-row"><span className="mr-dot" style={{ background: '#e8735a' }}></span><span className="mr-bar"></span><span className="mr-amt">12,000</span></div>
                <div className="mock-row"><span className="mr-dot" style={{ background: '#f0b429' }}></span><span className="mr-bar"></span><span className="mr-amt">38,500</span></div>
                <div className="mock-row"><span className="mr-dot" style={{ background: '#4a90d9' }}></span><span className="mr-bar"></span><span className="mr-amt">23,300</span></div>
              </div>
            </div>
            <div className="mock-foot">
              <div className="mf-left">
                <div className="mf-qr">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="#1a6e50" strokeWidth="1.4" /><rect x="11" y="2" width="5" height="5" rx="1" stroke="#1a6e50" strokeWidth="1.4" /><rect x="2" y="11" width="5" height="5" rx="1" stroke="#1a6e50" strokeWidth="1.4" /><rect x="11.5" y="11.5" width="1.8" height="1.8" fill="#1a6e50" /><rect x="14.2" y="11.5" width="1.8" height="1.8" fill="#1a6e50" /><rect x="11.5" y="14.2" width="1.8" height="1.8" fill="#1a6e50" /></svg>
                </div>
                <div className="mf-txt">
                  <strong>PromptPay QR</strong>
                  <span>ชำระเงินภายใน 7 วัน</span>
                </div>
              </div>
              <div className="mf-check">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <div className="strip" id="features">
        <div className="strip-in">
          <div className="strip-item">
            <div className="strip-ic">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="#22896a" strokeWidth="1.5" /><rect x="11" y="2" width="5" height="5" rx="1" stroke="#22896a" strokeWidth="1.5" /><rect x="2" y="11" width="5" height="5" rx="1" stroke="#22896a" strokeWidth="1.5" /><rect x="12" y="12" width="1.8" height="1.8" fill="#22896a" /><rect x="14.7" y="12" width="1.8" height="1.8" fill="#22896a" /><rect x="12" y="14.7" width="1.8" height="1.8" fill="#22896a" /></svg>
            </div>
            <div><strong>PromptPay QR</strong><span>ฝัง 7% ในใบแจ้งหนี้ในตัว</span></div>
          </div>
          <div className="strip-item">
            <div className="strip-ic">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4.5 15.5v-13h6l3 3v10h-9Z" stroke="#22896a" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 9h4M7 12h2.5" stroke="#22896a" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </div>
            <div><strong>PDF ภาษาไทย</strong><span>ใช้ฟอนต์มาตรฐานราชการ</span></div>
          </div>
          <div className="strip-item">
            <div className="strip-ic">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="#22896a" strokeWidth="1.5" /><path d="M6.5 9h5M9 6.5v5" stroke="#22896a" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </div>
            <div><strong>หลายสกุลเงิน</strong><span>THB/USD, USDT TRC-20</span></div>
          </div>
          <div className="strip-item">
            <div className="strip-ic">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2 15 4.5v4c0 3.6-2.5 6.4-6 7.5-3.5-1.1-6-3.9-6-7.5v-4L9 2Z" stroke="#22896a" strokeWidth="1.5" strokeLinejoin="round" /><path d="M6.5 9l1.8 1.8L12 7" stroke="#22896a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div><strong>ถูกต้องตามกฎหมาย</strong><span>ใบกำกับ invoice ตามมาตรฐาน</span></div>
          </div>
        </div>
      </div>

      {/* CHANNELS */}
      <section className="sec mint" id="channels">
        <div className="sec-in">
          <h2 className="sec-title">รับเงินได้ทุกช่องทาง</h2>
          <p className="sec-sub">ครอบคลุมทุกวิธีที่ลูกค้าไทยใช้: PromptPay QR, บัตรเครดิต, PayPal ต่างประเทศ หรือ USDT ทุกยอดเข้าไม่ตกหล่น</p>
          <div className="pay-grid">
            <div className="pay-card dark">
              <div className="pay-ic">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.2" stroke="#fff" strokeWidth="1.6" /><rect x="12" y="2" width="6" height="6" rx="1.2" stroke="#fff" strokeWidth="1.6" /><rect x="2" y="12" width="6" height="6" rx="1.2" stroke="#fff" strokeWidth="1.6" /><rect x="13" y="13" width="2" height="2" fill="#fff" /><rect x="16" y="13" width="2" height="2" fill="#fff" /><rect x="13" y="16" width="2" height="2" fill="#fff" /></svg>
              </div>
              <div className="pay-name">PromptPay QR</div>
              <div className="pay-desc">สร้าง QR ฝังในใบแจ้งหนี้ ลูกค้าสแกนจ่ายผ่านแอปธนาคารได้ทันที รองรับทุกธนาคารไทย</div>
              <span className="pay-tag">ยอดนิยม</span>
            </div>
            <div className="pay-card">
              <div className="pay-ic">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4.5" width="16" height="11" rx="2" stroke="#22896a" strokeWidth="1.6" /><path d="M2 8.5h16" stroke="#22896a" strokeWidth="1.6" /><rect x="4.5" y="11.5" width="4.5" height="1.8" rx=".9" fill="#22896a" /></svg>
              </div>
              <div className="pay-name">บัตรเครดิต / เดบิต</div>
              <div className="pay-desc">VISA, Mastercard, AMEX รองรับลูกค้าองค์กรและต่างประเทศ</div>
              <span className="pay-tag">THB · USD</span>
            </div>
            <div className="pay-card">
              <div className="pay-ic">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="#22896a" strokeWidth="1.6" /><path d="M10 6v8M7.5 8.2c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7c0 2.6-5 1.1-5 3.6 0 1 1.1 1.7 2.5 1.7s2.5-.7 2.5-1.7" stroke="#22896a" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </div>
              <div className="pay-name">USDT TRC-20</div>
              <div className="pay-desc">รับ Crypto บน Tron Network โอนไว ค่าธรรมเนียมต่ำ เหมาะกับลูกค้าสายดิจิทัล</div>
              <span className="pay-tag">Crypto</span>
            </div>
            <div className="pay-card">
              <div className="pay-ic">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 16V7l6-3.5L16 7v9" stroke="#22896a" strokeWidth="1.6" strokeLinejoin="round" /><path d="M2.5 16h15" stroke="#22896a" strokeWidth="1.6" strokeLinecap="round" /><path d="M7 16v-5h6v5" stroke="#22896a" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              </div>
              <div className="pay-name">โอนเงินธนาคาร</div>
              <div className="pay-desc">แนบเลขบัญชีในใบแจ้งหนี้ พร้อมระบบยืนยันยอดอัตโนมัติ</div>
              <span className="pay-tag">ทุกธนาคาร</span>
            </div>
            <div className="pay-card">
              <div className="pay-ic">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3.5 10a6.5 6.5 0 1 1 2 4.7" stroke="#22896a" strokeWidth="1.6" strokeLinecap="round" /><path d="M3.5 15v-4h4" stroke="#22896a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="pay-name">PayPal</div>
              <div className="pay-desc">สำหรับลูกค้าต่างประเทศ ส่งลิงก์ PayPal.me แนบในใบแจ้งหนี้ได้เลย</div>
              <span className="pay-tag">International</span>
            </div>
            <div className="pay-card">
              <div className="pay-ic">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="#22896a" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </div>
              <div className="pay-name">เพิ่มเติมเร็วๆ นี้</div>
              <div className="pay-desc">TrueMoney Wallet, LINE Pay และ e-Wallet อื่นๆ กำลังตามมา</div>
              <span className="pay-tag">Coming soon</span>
            </div>
          </div>
        </div>
      </section>

      {/* EVERYTHING SECTION */}
      <section className="sec">
        <div className="sec-in">
          <h2 className="sec-title">ทุกอย่างที่ธุรกิจไทยต้องการ</h2>
          <p className="sec-sub">ทั้ง lifecycle ของใบแจ้งหนี้ ตั้งแต่ DRAFT จนถึง PAID ครบจบในระบบเดียว</p>

          <div className="feat-hero">
            <div className="fh-left">
              <strong>PromptPay QR: first class</strong>
              <span>สร้าง PromptPay QR อัตโนมัติจากเบอร์หรือเลขประจำตัวผู้เสียภาษี ฝังในใบแจ้งหนี้และ PDF พร้อม VAT 7% และ WHT</span>
            </div>
            <div className="fh-qr">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><rect x="3" y="3" width="11" height="11" rx="2" stroke="#fff" strokeWidth="2.4" /><rect x="20" y="3" width="11" height="11" rx="2" stroke="#fff" strokeWidth="2.4" /><rect x="3" y="20" width="11" height="11" rx="2" stroke="#fff" strokeWidth="2.4" /><rect x="21" y="21" width="4" height="4" fill="#fff" /><rect x="27" y="21" width="4" height="4" fill="#fff" /><rect x="21" y="27" width="4" height="4" fill="#fff" /><rect x="27" y="27" width="4" height="4" fill="#fff" /></svg>
            </div>
          </div>

          <div className="feat-grid">
            <div className="feat-card">
              <div className="fc-ic red">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4.5 15.5v-13h6l3 3v10h-9Z" stroke="#d85a30" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 9.5h4M7 12h2.5" stroke="#d85a30" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </div>
              <strong>PDF ภาษาไทยมาตรฐาน</strong>
              <p>ตัวอักษรไทยสวยงามไม่เพี้ยน แสดง VAT 7% และ WHT ตามมาตรฐานสรรพากร พร้อมโลโก้แบรนด์ของคุณ</p>
            </div>
            <div className="feat-card">
              <div className="fc-ic blue">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="#378add" strokeWidth="1.5" /><path d="M9 5.5V9l2.2 2.2" stroke="#378add" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
              <strong>THB · USD · USDT</strong>
              <p>ออกใบแจ้งหนี้ได้หลายสกุลเงิน รองรับ PromptPay QR, บัตรเครดิต และ USDT TRC-20 ในเอกสารเดียว</p>
            </div>
            <div className="feat-card">
              <div className="fc-ic amber">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2 15 4.5v4c0 3.6-2.5 6.4-6 7.5-3.5-1.1-6-3.9-6-7.5v-4L9 2Z" stroke="#ba7517" strokeWidth="1.5" strokeLinejoin="round" /><path d="M6.5 9l1.8 1.8L12 7.2" stroke="#ba7517" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <strong>ติดตามทุก Invoice</strong>
              <p>สถานะครบทุกขั้น DRAFT → UNPAID → PAID → OVERDUE แจ้งเตือนอัตโนมัติเมื่อใกล้ครบกำหนด</p>
            </div>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="sec mint">
        <div className="sec-in">
          <h2 className="sec-title">ใช้งานง่าย 3 ขั้นตอน</h2>
          <p className="sec-sub">ออกแบบมาเพื่อเจ้าของธุรกิจ ไม่ใช่นักบัญชี</p>
          <div className="steps">
            <div className="step">
              <div className="step-n">1</div>
              <strong>สร้างใบแจ้งหนี้</strong>
              <p>กรอกรายการ ราคา และลูกค้า ระบบคำนวณ VAT และ WHT พร้อม PromptPay QR ให้อัตโนมัติ</p>
            </div>
            <div className="step">
              <div className="step-n">2</div>
              <strong>ส่งให้ลูกค้า</strong>
              <p>ดาวน์โหลด PDF สวยงาม หรือส่งลิงก์ผ่าน Email / LINE ลูกค้าเปิดดูและจ่ายได้ทันที</p>
            </div>
            <div className="step">
              <div className="step-n">3</div>
              <strong>รับเงิน</strong>
              <p>ลูกค้าสแกน QR จ่ายเสร็จ สถานะเปลี่ยนเป็น PAID อัตโนมัติ พร้อมแจ้งเตือนถึงคุณ</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="sec" id="pricing">
        <div className="sec-in" style={{ textAlign: 'center' }}>
          <h2 className="sec-title">ราคาตรงไปตรงมา</h2>
          <p className="sec-sub" style={{ marginLeft: 'auto', marginRight: 'auto' }}>เริ่มฟรี ไม่ต้องใส่บัตรเครดิต ไม่มีข้อผูกมัด</p>

          {/* PROMO BANNER */}
          <div className="promo">
            <svg className="promo-burst" viewBox="0 0 110 110" fill="none">
              <path d="M55 4l7.5 13.2 13.8-6.3-1.2 15.1 15.1-1.2-6.3 13.8L97.1 46l-13.2 7.5 13.2 7.5-13.2 7.5 6.3 13.8-15.1-1.2 1.2 15.1-13.8-6.3L55 103l-7.5-13.2-13.8 6.3 1.2-15.1-15.1 1.2 6.3-13.8L12.9 61l13.2-7.5L12.9 46l13.2-7.5-6.3-13.8 15.1 1.2-1.2-15.1 13.8 6.3L55 4Z" fill="#e05252" />
              <text x="55" y="48" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="800" fontFamily="'Noto Sans Thai',sans-serif">-67%</text>
              <text x="55" y="68" textAnchor="middle" fill="#ffd166" fontSize="12" fontWeight="800" fontFamily="'Noto Sans Thai',sans-serif">SHOCK!</text>
            </svg>
            <div className="promo-left">
              <span className="promo-tag">⚡ โปรพิเศษ จำกัดเวลา</span>
              <div className="promo-title">
                <span className="strike">฿599</span>เหลือ <span className="hot">฿199</span>/เดือน
              </div>
              <div className="promo-sub">แพ็กเกจ Pro นาน 6 เดือนเต็ม — ประหยัดกว่า ฿2,400</div>
            </div>
            <div className="promo-right">
              <div className="promo-timer">⏰ สิ้นสุด 31 ก.ค. นี้</div>
              <Link to="/register?promo=PRO199"><button className="btn-promo">รับโปรเลย →</button></Link>
            </div>
          </div>

          <div className="price-wrap">
            <div className="price">
              <h3>Free</h3>
              <div className="price-amt">฿0<span>/เดือน</span></div>
              <ul>
                <li><CheckIcon />ใบแจ้งหนี้ฟรี 5 ฉบับ/เดือน</li>
                <li><CheckIcon />PromptPay QR</li>
                <li><CheckIcon />PDF export</li>
                <li><CheckIcon />ลูกค้า 5 ราย</li>
              </ul>
              <Link to="/register"><button className="btn btn-outline">เริ่มใช้ฟรี</button></Link>
            </div>
            <div className="price pro">
              <span className="price-pop">🔥 โปร 6 เดือน -67%</span>
              <h3>Pro</h3>
              <div className="price-amt"><span style={{ fontSize: 19, color: 'var(--text-3)', textDecoration: 'line-through', fontWeight: 600, marginRight: 6 }}>฿599</span>฿199<span>/เดือน</span></div>
              <div style={{ fontSize: 12, color: 'var(--green-600)', fontWeight: 700, marginTop: 4 }}>นาน 6 เดือน · หลังจากนั้น ฿599/เดือน</div>
              <ul>
                <li><CheckIcon />ใบแจ้งหนี้ไม่จำกัด</li>
                <li><CheckIcon />ทุกช่องทางชำระเงิน</li>
                <li><CheckIcon />โลโก้และแบรนด์ของคุณ</li>
                <li><CheckIcon />Team members 14 คน</li>
                <li><CheckIcon />ทดลองใช้ฟรี 14 วัน</li>
              </ul>
              <Link to="/register?promo=PRO199"><button className="btn btn-solid">รับโปร ฿199 เลย</button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="cta">
        <div className="cta-in">
          <h2>พร้อมใช้งานภายใน 5 นาที</h2>
          <p>ไม่ต้องติดตั้ง ไม่ต้องอบรม สมัครแล้วสร้างใบแจ้งหนี้แรกได้ทันที รองรับ PromptPay และ USDT</p>
          <Link to="/register"><button className="btn-cta">เริ่มต้นใช้งานฟรี →</button></Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="foot-in">
          <Link to="/" className="logo" style={{ fontSize: 15 }}>
            <LogoMark size={20} />
            FinTrust
          </Link>
          <div className="foot-links">
            <a href="#features">ฟีเจอร์</a>
            <a href="#pricing">ราคา</a>
            <Link to="/privacy">นโยบายความเป็นส่วนตัว</Link>
            <Link to="/terms">เงื่อนไขการใช้งาน</Link>
          </div>
          <div className="foot-copy">© 2026 FinTrust</div>
        </div>
      </footer>
    </div>
  );
}
