import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Coffee,
  Download,
  Eye,
  LayoutGrid,
  Minus,
  Monitor,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import "./styles.css";
import "./auth.css";
import "./auth-v2.css";
import "./landing.css";
import "./content.css";
import "./partnership.css";
import "./sound.css";
import "./auth-modal.css";

const seed = {
  store: {
    name: "Mellow Cream",
    tagline: "오늘을 달콤하게 만드는 한 스쿱",
    accent: "#ff6b35",
    theme: "cream",
    radius: 22,
    departments: [],
    shotPrice: 500,
    ingredients: [
      { id: "vanilla", name: "바닐라 아이스크림", available: true },
      { id: "milk", name: "우유", available: true },
      { id: "berry", name: "베리", available: true },
    ],
  },
  categories: ["전체", "시그니처", "아이스크림", "음료"],
  items: [
    {
      id: 1,
      category: "시그니처",
      name: "선셋 선데",
      desc: "바닐라 아이스크림, 오렌지 콤포트, 바삭한 크럼블",
      price: 7200,
      emoji: "🍨",
      color: "#f7c6a3",
      badge: "BEST",
      soldout: false,
      ingredientIds: ["vanilla"],
      temperatureMode: "both",
      shotsEnabled: true,
      hotShots: true,
      iceShots: true,
      sizesEnabled: true,
      smallPrice: 6500,
      largePrice: 7200,
    },
    {
      id: 2,
      category: "아이스크림",
      name: "피스타치오 클라우드",
      desc: "고소한 피스타치오와 부드러운 우유의 조화",
      price: 5800,
      emoji: "🍦",
      color: "#cddcad",
      badge: "NEW",
      soldout: false,
      ingredientIds: ["milk"],
      temperatureMode: "ice",
      shotsEnabled: false,
      hotShots: false,
      iceShots: false,
      sizesEnabled: true,
      smallPrice: 5200,
      largePrice: 5800,
    },
    {
      id: 3,
      category: "시그니처",
      name: "베리 가든",
      desc: "세 가지 베리와 요거트 아이스크림",
      price: 6800,
      emoji: "🍓",
      color: "#e9a6ae",
      badge: "",
      soldout: false,
      ingredientIds: ["berry"],
      temperatureMode: "none",
      shotsEnabled: false,
      hotShots: false,
      iceShots: false,
      sizesEnabled: false,
      smallPrice: 6800,
      largePrice: 6800,
    },
  ],
};

const won = (n) => `${n.toLocaleString("ko-KR")}원`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const compressImage = (file, maxDimension = 720, maxBytes = 50000) =>
  new Promise((resolve, reject) => {
    if (!file?.type.startsWith("image/"))
      return reject(new Error("이미지 파일만 선택할 수 있습니다."));
    if (file.size > 12 * 1024 * 1024)
      return reject(new Error("원본 이미지는 12MB 이하만 사용할 수 있습니다."));
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(
        1,
        maxDimension / Math.max(image.width, image.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      let quality = 0.84;
      let result = canvas.toDataURL("image/webp", quality);
      while (result.length * 0.75 > maxBytes && quality > 0.32) {
        quality -= 0.1;
        result = canvas.toDataURL("image/webp", quality);
      }
      if (result.length * 0.75 > maxBytes)
        return reject(
          new Error(
            "이미지를 충분히 압축할 수 없습니다. 더 작은 사진을 선택해 주세요.",
          ),
        );
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };
    image.src = url;
  });
const readAlertMp3 = async (file) => {
  if (
    !file ||
    (!file.type.includes("mpeg") && !file.name.toLowerCase().endsWith(".mp3"))
  )
    throw new Error("MP3 파일만 등록할 수 있습니다.");
  if (file.size > 350000)
    throw new Error("알림음 파일은 350KB 이하로 선택해 주세요.");
  const buffer = await file.arrayBuffer();
  const context = new (window.AudioContext || window.webkitAudioContext)();
  let decoded;
  try {
    decoded = await context.decodeAudioData(buffer.slice(0));
  } finally {
    await context.close();
  }
  if (decoded.duration >= 2)
    throw new Error(
      `알림음은 2초 미만이어야 합니다. 선택한 파일은 ${decoded.duration.toFixed(2)}초입니다.`,
    );
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("MP3 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
};
const playNotificationSound = (store, contextRef) => {
  const volume = Math.max(
    0.1,
    Math.min(1, Number(store.notificationVolume ?? 0.8)),
  );
  if (store.notificationSound === "custom" && store.notificationAudio) {
    const audio = new Audio(store.notificationAudio);
    audio.volume = volume;
    audio.play().catch(() => {});
    return;
  }
  try {
    let context = contextRef.current;
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
      contextRef.current = context;
    }
    context.resume?.();
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume * 0.55, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.45);
    gain.connect(context.destination);
    const patterns = {
      bell: [
        [880, 0, 0.18],
        [1175, 0.2, 0.2],
        [1568, 0.45, 0.48],
      ],
      chime: [
        [659, 0, 0.25],
        [784, 0.18, 0.28],
        [988, 0.38, 0.55],
      ],
      urgent: [
        [1046, 0, 0.18],
        [784, 0.22, 0.18],
        [1046, 0.44, 0.18],
        [1397, 0.68, 0.5],
      ],
    };
    (patterns[store.notificationSound] || patterns.bell).forEach(
      ([frequency, start, length]) => {
        const oscillator = context.createOscillator();
        oscillator.type =
          store.notificationSound === "urgent" ? "square" : "sine";
        oscillator.frequency.setValueAtTime(
          frequency,
          context.currentTime + start,
        );
        oscillator.connect(gain);
        oscillator.start(context.currentTime + start);
        oscillator.stop(context.currentTime + start + length);
      },
    );
  } catch {}
};
const isMenuSoldOut = (item, store) =>
  !!item.soldout ||
  (item.ingredientIds || []).some(
    (id) =>
      (store.ingredients || []).find((ingredient) => ingredient.id === id)
        ?.available === false,
  );
const kioskText = {
  heroTop: "HAVE A SWEET DAY",
  heroA: "오늘은 어떤",
  heroB: "달콤함",
  heroC: "이 필요하세요?",
  search: "메뉴 검색",
  dine: "매장",
  takeout: "포장",
  order: "주문",
  change: "변경",
  soldout: "오늘은 품절",
  addPrompt: "메뉴를 담아주세요",
  back: "메뉴로 돌아가기",
  check: "주문을 확인해 주세요",
  selected: "선택한 메뉴",
  payment: "결제 금액",
  customer: "주문자 이름",
  optional: "선택",
  namePlaceholder: "예: 김민지",
  products: "상품 금액",
  discount: "할인",
  total: "총 결제 금액",
  submit: "주문 접수하기",
  sending: "주문 전송 중...",
  paymentNote: "실제 결제 연동 전까지 주문만 접수됩니다.",
  received: "주문이 접수되었어요",
  number: "주문번호",
  notified: "판매자에게 새 주문 알림을 보냈습니다.",
  home: "처음으로",
  reset: (n) => `${n}초 후 다음 고객 화면으로 돌아갑니다.`,
};
const api = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    error.retryAfter = Number(
      response.headers.get("retry-after") || payload.retryAfter || 0,
    );
    error.emergency = !!payload.emergency;
    throw error;
  }
  return payload;
};

function Root() {
  const publicShop = location.pathname.startsWith("/shop/");
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    if (publicShop) return;
    api("/api/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, [publicShop]);
  useEffect(() => {
    if (!publicShop && user === null && location.pathname !== "/login")
      history.replaceState({}, "", "/login");
  }, [user, publicShop]);
  if (publicShop) return <CustomerPage />;
  if (user === undefined)
    return (
      <div className="auth-loading">
        <div className="brandmark">
          <Sparkles />
        </div>
        <p>매장을 불러오는 중...</p>
      </div>
    );
  const finishAuth = (u) => {
    history.replaceState({}, "", "/seller");
    setUser(u);
  };
  if (!user) return <AuthPage onAuth={finishAuth} />;
  if (user.role === "seller" && location.pathname !== "/seller")
    history.replaceState({}, "", "/seller");
  const logout = async () => {
    await api("/api/logout", { method: "POST" });
    setUser(null);
  };
  return <Studio user={user} onLogout={logout} />;
}

function PartnershipSection() {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setMessage("");
    const form = event.currentTarget;
    try {
      const response = await fetch("https://formspree.io/f/mbdnnbrn", {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.errors?.map((error) => error.message).join(", ") ||
            "문의를 전송하지 못했습니다.",
        );
      }
      setState("success");
      setMessage(
        "제휴 문의가 전송되었습니다. 확인 후 입력하신 이메일로 답변드릴게요.",
      );
      form.reset();
    } catch (error) {
      setState("error");
      setMessage(
        error.message || "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
      );
    }
  };
  return (
    <section className="landing-section partnership-section" id="partnership">
      <div className="partnership-copy">
        <span>PARTNERSHIP</span>
        <h2>
          GENO Stuido와
          <br />
          함께 만들고 싶나요?
        </h2>
        <p>
          서비스 제휴, 매장 도입, 콘텐츠 협업과 개선 제안을 보내주세요. 구체적인
          배경과 원하는 방식을 알려주시면 더 정확하게 확인할 수 있습니다.
        </p>
        <div>
          <i>✦</i>
          <span>
            <b>제휴 문의 전용</b>
            <small>광고성 메시지가 아닌 실제 협업 제안을 기다립니다.</small>
          </span>
        </div>
      </div>
      <form className="partnership-form" onSubmit={submit}>
        <input type="hidden" name="_subject" value="GENO Stuido 새 제휴 문의" />
        <label>
          <span>회사·매장명</span>
          <input
            name="company"
            required
            maxLength="80"
            placeholder="예: GENO Coffee"
          />
        </label>
        <label>
          <span>담당자명</span>
          <input
            name="name"
            required
            maxLength="40"
            autoComplete="name"
            placeholder="담당자 이름"
          />
        </label>
        <label>
          <span>회신 이메일</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@company.com"
          />
        </label>
        <label>
          <span>제휴 유형</span>
          <select name="partnership_type" required defaultValue="">
            <option value="" disabled>
              선택해 주세요
            </option>
            <option>매장 도입 문의</option>
            <option>서비스 제휴</option>
            <option>콘텐츠 협업</option>
            <option>기능·개선 제안</option>
            <option>기타</option>
          </select>
        </label>
        <label className="wide">
          <span>제안 내용</span>
          <textarea
            name="message"
            required
            minLength="10"
            maxLength="2000"
            placeholder="제안 배경과 원하는 협업 방식을 10자 이상 적어주세요."
          />
        </label>
        <input
          className="form-honeypot"
          type="text"
          name="_gotcha"
          tabIndex="-1"
          autoComplete="off"
        />
        <label className="partnership-consent wide">
          <input type="checkbox" required />
          <span>
            답변을 위해 입력한 이름, 이메일과 문의 내용이 Formspree로 전달되는
            것에 동의합니다.
          </span>
        </label>
        <div className="partnership-actions wide">
          <button type="submit" disabled={state === "sending"}>
            {state === "sending" ? "안전하게 전송 중..." : "제휴 문의 보내기"}
            <ChevronRight />
          </button>
          <p className={state}>{message}</p>
        </div>
      </form>
    </section>
  );
}

function SellerAuthForm({ mode, setMode, error, setError, busy, submit }) {
  return (
    <form className="auth-form seller-auth-modal-form" onSubmit={submit}>
      <div className="auth-form-icon">
        <Store />
      </div>
      <span className="auth-kicker">SELLER WORKSPACE</span>
      <h2>{mode === "login" ? "내 매장으로 돌아가기" : "새 매장 시작하기"}</h2>
      <p>
        {mode === "login"
          ? "판매자 계정으로 로그인해 오늘의 매장을 운영하세요."
          : "비용 없이 계정을 만들고 나만의 주문 사이트를 완성하세요."}
      </p>
      <div className="auth-mode-tabs">
        <button
          type="button"
          className={mode === "login" ? "on" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          로그인
        </button>
        <button
          type="button"
          className={mode === "register" ? "on" : ""}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          회원가입
        </button>
      </div>
      {mode === "register" && (
        <Field label="판매자 이름">
          <input
            name="name"
            required
            maxLength="40"
            placeholder="이름을 입력하세요"
          />
        </Field>
      )}
      <Field label="이메일">
        <input
          name="email"
          type="email"
          required
          placeholder="owner@example.com"
          autoComplete="email"
        />
      </Field>
      <Field label="비밀번호">
        <input
          name="password"
          type="password"
          required
          minLength="8"
          placeholder="8자 이상 입력하세요"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </Field>
      {error && <div className="auth-error">{error}</div>}
      <button className="auth-submit" disabled={busy}>
        {busy
          ? "안전하게 연결하는 중..."
          : mode === "login"
            ? "판매자 로그인"
            : "무료로 시작하기"}
        <ChevronRight />
      </button>
      <div className="auth-assurance">
        <span>
          <Check /> 판매자 전용
        </span>
        <span>
          <Check /> 서버 자동 저장
        </span>
        <span>
          <Check /> 별도 설치 없음
        </span>
      </div>
    </form>
  );
}

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await api(`/api/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
          name: f.get("name"),
        }),
      });
      onAuth(r.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-landing">
      <nav className="landing-nav">
        <div className="brand">
          <div className="brandmark">
            <Sparkles size={18} />
          </div>
          <span>GENO</span>
          <b>Stuido</b>
        </div>
        <div>
          <a href="#features">기능</a>
          <a href="#flow">제작 과정</a>
          <a href="#guide">운영 가이드</a>
          <a href="#partnership">제휴 문의</a>
          <a href="#safety">무료 운영</a>
        </div>
        <button className="landing-login" onClick={() => setAuthOpen(true)}>
          판매자 로그인 <ChevronRight />
        </button>
      </nav>
      <div className="auth-page auth-v2">
        <section className="auth-story">
          <div className="auth-story-top">
            <div className="brand auth-brand">
              <div className="brandmark">
                <Sparkles size={18} />
              </div>
              <span>GENO</span>
              <b>Stuido</b>
            </div>
            <span className="auth-live">
              <i /> ALL-IN-ONE KIOSK STUDIO
            </span>
          </div>
          <div className="auth-hero-copy">
            <span className="auth-kicker">BUILD · OPERATE · GROW</span>
            <h1>
              당신만의 키오스크를
              <br />
              <em>오늘 바로 시작하세요.</em>
            </h1>
            <p>
              메뉴를 만들고, 고객 주문을 받고, 판매 현황을 확인하는 모든 과정을
              하나의 작업실에 담았습니다.
            </p>
            <div className="auth-metrics">
              <div>
                <b>0원</b>
                <span>시작 비용</span>
              </div>
              <div>
                <b>실시간</b>
                <span>주문 알림</span>
              </div>
              <div>
                <b>150건</b>
                <span>일일 주문 기록</span>
              </div>
            </div>
          </div>
          <div className="auth-product-preview">
            <div className="preview-titlebar">
              <span>
                <i />
                <i />
                <i />
              </span>
              <b>GENO Seller Studio</b>
              <em>
                <i /> LIVE
              </em>
            </div>
            <div className="preview-layout">
              <aside>
                <div className="preview-logo">G</div>
                <span className="on">
                  <LayoutGrid />
                </span>
                <span>
                  <Coffee />
                </span>
                <span>
                  <ShoppingBag />
                </span>
                <span>
                  <BarChart3 />
                </span>
              </aside>
              <main>
                <div className="preview-welcome">
                  <div>
                    <small>2026년 8월 3일</small>
                    <b>좋은 하루예요, 판매자님 👋</b>
                  </div>
                  <button>고객 화면 열기</button>
                </div>
                <div className="preview-stats">
                  <article>
                    <span>오늘 주문</span>
                    <b>
                      12<small>건</small>
                    </b>
                    <em>+ 3건</em>
                  </article>
                  <article>
                    <span>오늘 매출</span>
                    <b>
                      148,500<small>원</small>
                    </b>
                    <em>실시간 반영</em>
                  </article>
                  <article>
                    <span>판매 메뉴</span>
                    <b>
                      8<small>개</small>
                    </b>
                    <em>품절 1개</em>
                  </article>
                </div>
                <div className="preview-orders">
                  <div>
                    <b>실시간 주문</b>
                    <span>전체 보기</span>
                  </div>
                  <article>
                    <i>NEW</i>
                    <span>
                      <b>#A102 · 김민지</b>
                      <small>선셋 선데 · ICE · L · 샷 1회</small>
                    </span>
                    <strong>7,700원</strong>
                  </article>
                  <article>
                    <i className="ready">준비중</i>
                    <span>
                      <b>#A101 · 중고등부</b>
                      <small>베리 가든 × 2</small>
                    </span>
                    <strong>13,600원</strong>
                  </article>
                </div>
              </main>
            </div>
            <div className="auth-order-pop">
              <span>🔔</span>
              <div>
                <b>새 주문이 도착했어요</b>
                <small>주문 #A102 · 방금 전</small>
              </div>
            </div>
          </div>
          <div className="auth-feature-strip">
            <span>
              <Check /> 온도·사이즈·샷 설정
            </span>
            <span>
              <Check /> 재료별 자동 품절
            </span>
            <span>
              <Check /> 완료·환불 기록
            </span>
            <span>
              <Check /> 부서별 엑셀
            </span>
          </div>
        </section>
        <section className="auth-form-wrap auth-entry" id="seller-login">
          <div className="entry-orbit">
            <span>🍨</span>
            <i>✦</i>
            <i>↗</i>
          </div>
          <span className="auth-kicker">YOUR STORE STARTS HERE</span>
          <h2>
            준비되셨나요?
            <br />내 매장을 열어보세요.
          </h2>
          <p>
            판매자 계정 하나로 키오스크 제작, 고객 주문 사이트와 매장 운영
            화면을 시작합니다.
          </p>
          <button
            className="entry-primary"
            onClick={() => {
              setMode("register");
              setAuthOpen(true);
            }}
          >
            무료로 시작하기 <ChevronRight />
          </button>
          <button
            className="entry-secondary"
            onClick={() => {
              setMode("login");
              setAuthOpen(true);
            }}
          >
            이미 계정이 있어요
          </button>
          <div className="entry-points">
            <span>
              <Check /> 카드 등록 없음
            </span>
            <span>
              <Check /> 유료 API 없음
            </span>
            <span>
              <Check /> 판매자 전용 계정
            </span>
          </div>
        </section>
      </div>
      {authOpen && (
        <div
          className="seller-auth-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setAuthOpen(false)
          }
        >
          <div
            className="seller-auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="판매자 로그인"
          >
            <button
              className="seller-auth-close"
              onClick={() => setAuthOpen(false)}
            >
              <X />
            </button>
            <div className="seller-auth-brand">
              <div className="brandmark">
                <Sparkles />
              </div>
              <span>GENO Stuido</span>
              <small>안전한 판매자 작업실</small>
            </div>
            <SellerAuthForm
              mode={mode}
              setMode={setMode}
              error={error}
              setError={setError}
              busy={busy}
              submit={submit}
            />
          </div>
        </div>
      )}
      <section className="landing-section feature-section" id="features">
        <div className="landing-heading">
          <span>EVERYTHING YOUR STORE NEEDS</span>
          <h2>
            예쁜 화면에서 끝나지 않는
            <br />
            <em>진짜 매장 운영 도구</em>
          </h2>
          <p>
            키오스크 제작부터 주문 처리와 판매 기록까지 서로 연결되어
            움직입니다.
          </p>
        </div>
        <div className="landing-feature-grid">
          <article className="feature-big">
            <i>
              <LayoutGrid />
            </i>
            <span>01 · BUILD</span>
            <h3>
              내 브랜드 그대로
              <br />
              키오스크를 디자인하세요.
            </h3>
            <p>
              로고, 음식 사진, 색상과 모서리 스타일을 바꾸면 고객 화면에 즉시
              반영됩니다.
            </p>
            <div className="mini-menu-showcase">
              <b>오늘의 메뉴</b>
              <div>
                <span>🍨</span>
                <span>☕</span>
                <span>🥐</span>
              </div>
            </div>
          </article>
          <article>
            <i>
              <ShoppingBag />
            </i>
            <span>02 · ORDERS</span>
            <h3>주문이 오면 바로 알려드려요.</h3>
            <p>
              새 주문 자동 이동, 알림음, 준비·완료·환불까지 한 화면에서
              처리합니다.
            </p>
          </article>
          <article className="dark-card">
            <i>
              <Package />
            </i>
            <span>03 · STOCK</span>
            <h3>
              재료가 떨어지면
              <br />
              메뉴도 자동 품절.
            </h3>
            <p>재료 하나로 여러 메뉴의 판매 상태를 함께 관리합니다.</p>
          </article>
          <article>
            <i>
              <BarChart3 />
            </i>
            <span>04 · INSIGHT</span>
            <h3>실제로 판매된 데이터만 분석.</h3>
            <p>
              완료 주문을 기준으로 매출과 인기 메뉴를 확인하고 부서별로
              내보냅니다.
            </p>
          </article>
          <article className="accent-card">
            <i>
              <Sparkles />
            </i>
            <span>05 · YOUR BRAND</span>
            <h3>
              누구나 같은 모양이 아닌
              <br />
              우리 매장만의 주문 경험.
            </h3>
            <p>
              HOT·ICE, 샷, 사이즈, 부서와 재료까지 판매자가 직접 결정합니다.
            </p>
          </article>
        </div>
      </section>
      <section className="landing-section flow-section" id="flow">
        <div className="landing-heading">
          <span>FROM IDEA TO LIVE STORE</span>
          <h2>
            매장을 여는 과정은
            <br />
            놀랄 만큼 단순하게.
          </h2>
        </div>
        <div className="flow-line">
          <article>
            <b>01</b>
            <i>🎨</i>
            <h3>브랜드 꾸미기</h3>
            <p>로고와 대표 색상을 등록합니다.</p>
          </article>
          <article>
            <b>02</b>
            <i>🍽️</i>
            <h3>메뉴 만들기</h3>
            <p>사진, 가격과 주문 옵션을 설정합니다.</p>
          </article>
          <article>
            <b>03</b>
            <i>↗</i>
            <h3>사이트 내보내기</h3>
            <p>고객에게 전용 주소를 공유합니다.</p>
          </article>
          <article>
            <b>04</b>
            <i>🔔</i>
            <h3>주문 운영</h3>
            <p>도착한 주문을 실시간으로 처리합니다.</p>
          </article>
        </div>
      </section>
      <section className="landing-section quality-section" id="guide">
        <div className="quality-intro">
          <span>QUALITY BEFORE QUANTITY</span>
          <h2>
            메뉴가 많아서가 아니라,
            <br />
            고르기 쉬워서 좋은 키오스크.
          </h2>
          <p>
            고객을 오래 붙잡는 복잡한 화면보다 원하는 메뉴와 옵션을 빠르게 찾고
            정확하게 주문하는 경험을 우선합니다.
          </p>
        </div>
        <div className="quality-principles">
          <article>
            <b>01</b>
            <div>
              <h3>중복은 줄이고 선택은 선명하게</h3>
              <p>
                비슷한 메뉴와 불필요한 화면을 정리하고 카테고리, 사진, 품절
                상태를 한눈에 보여줍니다.
              </p>
            </div>
          </article>
          <article>
            <b>02</b>
            <div>
              <h3>화면에서 약속한 기능은 실제로</h3>
              <p>
                주문 버튼은 주문을 저장하고, 품절 표시는 판매를 막으며, 내보낸
                주소는 다른 기기에서도 열립니다.
              </p>
            </div>
          </article>
          <article>
            <b>03</b>
            <div>
              <h3>고객이 다시 찾을 이유 만들기</h3>
              <p>
                매장 로고와 음식 사진, 정확한 재료 설명으로 어디서나 같은 브랜드
                경험을 제공합니다.
              </p>
            </div>
          </article>
        </div>
      </section>
      <section className="landing-section insight-section">
        <div className="insight-head">
          <div>
            <span>STORE PLAYBOOK</span>
            <h2>
              운영할수록 더 좋아지는
              <br />
              작은 매장 가이드
            </h2>
          </div>
          <p>
            좋은 키오스크는 설치로 끝나지 않습니다.
            <br />
            실제 주문을 보고 다음 영업일을 더 단단하게 준비하세요.
          </p>
        </div>
        <div className="insight-grid">
          <article className="insight-lead">
            <div className="insight-art">
              <span>12</span>
              <i>ORDERS</i>
              <b>↗</b>
            </div>
            <small>운영 가이드 · 5분</small>
            <h3>
              첫 영업일에는 메뉴 수보다
              <br />
              주문 흐름을 먼저 확인하세요.
            </h3>
            <p>
              핵심 메뉴로 시작하고 고객이 온도·사이즈·부서를 어려움 없이
              선택하는지 확인한 뒤 메뉴를 늘리는 것이 좋습니다.
            </p>
            <a href="#seller-login">내 매장으로 적용하기 →</a>
          </article>
          <div className="insight-list">
            <article>
              <span>MENU QUALITY</span>
              <h3>음식 사진은 실제 제공 모습과 가깝게</h3>
              <p>
                과장된 사진보다 밝고 선명한 한 장이 고객의 선택을 더 빠르게
                만듭니다.
              </p>
            </article>
            <article>
              <span>STOCK CONTROL</span>
              <h3>재료 소진 전에 연결 메뉴 확인하기</h3>
              <p>
                공통 재료를 연결하면 한 번의 재고 변경으로 관련 메뉴를 함께 품절
                처리할 수 있습니다.
              </p>
            </article>
            <article>
              <span>DAILY CLOSE</span>
              <h3>자정 전에 부서별 기록 내보내기</h3>
              <p>
                완료·환불·결제수단 기록을 내려받아 다음 날 운영과 정산에
                활용하세요.
              </p>
            </article>
          </div>
        </div>
      </section>
      <section className="landing-section scenario-section">
        <div className="scenario-copy">
          <span>EXAMPLE STORE STORY</span>
          <h2>
            주문 한 건이
            <br />
            완료되기까지.
          </h2>
          <p>
            GENO Stuido의 기능이 실제 매장에서 어떻게 이어지는지 보여주는 예시
            시나리오입니다.
          </p>
        </div>
        <div className="scenario-timeline">
          <article>
            <i>10:02</i>
            <div>
              <b>고객 주문</b>
              <p>ICE · L · 샷 1회와 부서를 선택해 주문합니다.</p>
            </div>
            <span>7,700원</span>
          </article>
          <article>
            <i>10:02</i>
            <div>
              <b>판매자 알림</b>
              <p>주문 탭이 열리고 알림음으로 새 주문을 알려줍니다.</p>
            </div>
            <span className="orange">NEW</span>
          </article>
          <article>
            <i>10:07</i>
            <div>
              <b>판매 완료</b>
              <p>결제수단과 완료시각이 기록되고 판매 분석에 반영됩니다.</p>
            </div>
            <span className="green">DONE</span>
          </article>
        </div>
      </section>
      <section className="landing-section faq-section">
        <div className="landing-heading">
          <span>BEFORE YOU START</span>
          <h2>
            시작하기 전에
            <br />
            많이 묻는 질문.
          </h2>
        </div>
        <div className="faq-list">
          <details open>
            <summary>
              고객도 로그인해야 하나요?
              <Plus />
            </summary>
            <p>
              아니요. 로그인과 회원가입은 판매자 전용이며, 소비자는 매장 전용
              주소를 열어 바로 주문합니다.
            </p>
          </details>
          <details>
            <summary>
              사진을 올리면 비용이 발생하나요?
              <Plus />
            </summary>
            <p>
              별도 유료 이미지 API를 사용하지 않습니다. 사진을 브라우저에서 자동
              압축해 현재 프로젝트 데이터에 함께 저장합니다.
            </p>
          </details>
          <details>
            <summary>
              인터넷이 잠시 느리면 주문이 두 번 들어가나요?
              <Plus />
            </summary>
            <p>
              각 주문에 고유 요청번호를 부여해 같은 주문이 다시 전송되더라도
              하나만 생성합니다.
            </p>
          </details>
          <details>
            <summary>
              무료 서버가 포화되면 자동 결제되나요?
              <Plus />
            </summary>
            <p>
              무료 플랜을 유지하며 자동 유료 전환 기능을 사용하지 않습니다.
              요청량 보호 모드가 먼저 작동합니다.
            </p>
          </details>
        </div>
      </section>
      <PartnershipSection />
      <section className="landing-section safety-section" id="safety">
        <div>
          <span className="auth-kicker">FREE-FIRST INFRASTRUCTURE</span>
          <h2>
            비용 걱정보다
            <br />
            매장에 집중하세요.
          </h2>
          <p>
            유료 AI와 외부 결제 API 없이 시작합니다. 자동 저장, 중복 주문 방지,
            요청량 보호와 캐시가 무료 서버를 오래 지켜줍니다.
          </p>
          <a href="#seller-login">
            무료로 내 키오스크 만들기 <ChevronRight />
          </a>
        </div>
        <div className="safety-orbit">
          <i>0원</i>
          <span>유료 API 없음</span>
          <span>자동 과금 없음</span>
          <span>무료 보호 모드</span>
        </div>
      </section>
      <footer className="landing-footer">
        <div className="brand">
          <div className="brandmark">
            <Sparkles />
          </div>
          <span>GENO</span>
          <b>Stuido</b>
        </div>
        <p>메뉴가 주문이 되고, 주문이 매장의 성장이 되는 곳.</p>
        <a href="#seller-login">SELLER WORKSPACE ↗</a>
      </footer>
    </div>
  );
}

function CustomerPage() {
  const slug = location.pathname.startsWith("/shop/")
    ? decodeURIComponent(location.pathname.split("/")[2] || "")
    : "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!slug) {
      setError("올바른 매장 주소로 접속해 주세요.");
      return;
    }
    setError("");
    api(`/api/store/${encodeURIComponent(slug)}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }, [slug]);
  if (!data)
    return (
      <div className="auth-loading">
        <div className="brandmark">
          <Store />
        </div>
        <p>{error || "매장 메뉴를 불러오는 중..."}</p>
        {error && (
          <button className="simple-logout" onClick={() => location.reload()}>
            다시 시도
          </button>
        )}
      </div>
    );
  return (
    <div className="customer-page public">
      <Kiosk
        data={data}
        onOrder={(order) =>
          api("/api/orders", {
            method: "POST",
            body: JSON.stringify({ ...order, storeSlug: slug }),
          })
        }
      />
    </div>
  );
}

function Studio({ user, onLogout }) {
  const [data, setData] = useState(() => clone(seed));
  const [section, setSection] = useState("design");
  const [device, setDevice] = useState("tablet");
  const [published, setPublished] = useState(false);
  const [customer, setCustomer] = useState(false);
  const [orders, setOrders] = useState([]);
  const [storeSlug, setStoreSlug] = useState(null);
  const [exportInfo, setExportInfo] = useState(null);
  const [saveState, setSaveState] = useState("saved");
  const fileRef = useRef();
  const loaded = useRef(false);
  const latestOrderId = useRef(null);
  const ordersInitialized = useRef(false);
  const audioRef = useRef(null);
  const dataRef = useRef(data);
  const sectionRef = useRef(section);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    api("/api/project")
      .then((r) => {
        if (r.data) setData(r.data);
        setStoreSlug(r.slug);
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    setSaveState("saving");
    const timer = setTimeout(
      () =>
        api("/api/project", { method: "PUT", body: JSON.stringify({ data }) })
          .then(() => setSaveState("saved"))
          .catch(() => setSaveState("error")),
      700,
    );
    return () => clearTimeout(timer);
  }, [data]);
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current)
        audioRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);
  useEffect(() => {
    sectionRef.current = section;
  }, [section]);
  useEffect(() => {
    const tabId = crypto.randomUUID();
    const lockKey = "geno-order-poll-leader";
    const channel =
      "BroadcastChannel" in window ? new BroadcastChannel("geno-orders") : null;
    let timer;
    let leader = false;
    let lastNewAt = 0;
    let failures = 0;
    const ring = () => playNotificationSound(dataRef.current.store, audioRef);
    const accept = (list) => {
      const newest = list[0];
      const hasNew =
        ordersInitialized.current &&
        newest?.id &&
        newest.id !== latestOrderId.current;
      if (hasNew) {
        lastNewAt = Date.now();
        setSection("orders");
        ring();
        if ("Notification" in window && Notification.permission === "granted")
          new Notification("새 주문이 도착했어요", {
            body: `${newest.customer_name}님의 주문을 확인해 주세요.`,
          });
      }
      latestOrderId.current = newest?.id || null;
      ordersInitialized.current = true;
      setOrders(list);
    };
    const claim = () => {
      try {
        const current = JSON.parse(localStorage.getItem(lockKey) || "null");
        if (!current || current.expires < Date.now() || current.id === tabId) {
          localStorage.setItem(
            lockKey,
            JSON.stringify({ id: tabId, expires: Date.now() + 8000 }),
          );
          leader = true;
          return true;
        }
      } catch {
        leader = true;
        return true;
      }
      leader = false;
      return false;
    };
    const delay = () => {
      if (failures) return Math.min(120000, 5000 * 2 ** Math.min(failures, 5));
      return document.hidden
        ? 60000
        : sectionRef.current === "orders" || Date.now() - lastNewAt < 60000
          ? 4000
          : Date.now() - lastNewAt < 300000
            ? 10000
            : 20000;
    };
    const tick = async () => {
      if (claim()) {
        try {
          const result = await api("/api/orders");
          failures = 0;
          accept(result.orders);
          channel?.postMessage({ type: "orders", orders: result.orders });
        } catch (error) {
          failures += 1;
          if (error.retryAfter)
            failures = Math.max(
              failures,
              Math.ceil(Math.log2(error.retryAfter / 5 + 1)),
            );
        }
      }
      timer = setTimeout(tick, leader ? delay() : 5000);
    };
    channel &&
      (channel.onmessage = (event) => {
        if (event.data?.type === "orders" && Array.isArray(event.data.orders))
          accept(event.data.orders);
      });
    const heartbeat = setInterval(() => {
      if (leader)
        try {
          localStorage.setItem(
            lockKey,
            JSON.stringify({ id: tabId, expires: Date.now() + 8000 }),
          );
        } catch {}
    }, 3000);
    const visibility = () => {
      clearTimeout(timer);
      if (document.hidden && leader) {
        leader = false;
        try {
          const current = JSON.parse(localStorage.getItem(lockKey) || "null");
          if (current?.id === tabId) localStorage.removeItem(lockKey);
        } catch {}
      }
      timer = setTimeout(tick, document.hidden ? 60000 : 0);
    };
    document.addEventListener("visibilitychange", visibility);
    tick();
    return () => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", visibility);
      channel?.close();
      try {
        const current = JSON.parse(localStorage.getItem(lockKey) || "null");
        if (current?.id === tabId) localStorage.removeItem(lockKey);
      } catch {}
    };
  }, []);
  const updateStore = (patch) =>
    setData((d) => ({ ...d, store: { ...d.store, ...patch } }));
  const exportSites = async () => {
    try {
      if (!data.items.length)
        throw new Error("메뉴를 하나 이상 등록한 뒤 내보내 주세요.");
      setSaveState("saving");
      const saved = await api("/api/project", {
        method: "PUT",
        body: JSON.stringify({ data }),
      });
      const result = await api("/api/export", { method: "POST" });
      const slug = result.slug || saved.slug;
      setStoreSlug(slug);
      setSaveState("saved");
      setExportInfo({ customer: `${location.origin}/shop/${slug}` });
    } catch (e) {
      setSaveState("error");
      alert(e.message);
    }
  };
  const exportData = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    a.download = "mellow-cream-kiosk.json";
    a.click();
  };
  const importData = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        setData(JSON.parse(r.result));
      } catch {
        alert("올바른 프로젝트 파일이 아닙니다.");
      }
    };
    r.readAsText(f);
  };

  if (customer) return <Kiosk data={data} onExit={() => setCustomer(false)} />;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brandmark">
            <Sparkles size={18} />
          </div>
          <span>GENO</span>
          <b>Stuido</b>
        </div>
        <div className="project-title">
          <span className="status-dot" /> {data.store.name}
          <span className="muted">/ 키오스크 01</span>
        </div>
        <div className="top-actions">
          <span className={`saved ${saveState}`}>
            <Check size={14} />{" "}
            {saveState === "saving"
              ? "저장하는 중..."
              : saveState === "error"
                ? "저장 실패 · 연결 확인"
                : "서버에 안전하게 저장됨"}
          </span>
          <button className="icon-btn" onClick={exportData} title="내보내기">
            <Download size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={() => fileRef.current.click()}
            title="가져오기"
          >
            <Upload size={18} />
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="application/json"
            onChange={importData}
          />
          <button className="btn secondary" onClick={() => setCustomer(true)}>
            <Eye size={17} /> 미리보기
          </button>
          <button className="btn primary" onClick={exportSites}>
            <Download size={16} /> 내보내기
          </button>
          <ProfileMenu user={user} onLogout={onLogout} />
        </div>
      </header>
      <aside className="sidebar">
        <nav>
          <Nav
            icon={LayoutGrid}
            label="디자인"
            active={section === "design"}
            onClick={() => setSection("design")}
          />
          <Nav
            icon={Upload}
            label="로고·사진"
            active={section === "media"}
            onClick={() => setSection("media")}
          />
          <Nav
            icon={Coffee}
            label="메뉴"
            active={section === "menu"}
            onClick={() => setSection("menu")}
          />
          <Nav
            icon={Package}
            label="재료"
            active={section === "ingredients"}
            onClick={() => setSection("ingredients")}
          />
          <Nav
            icon={ShoppingBag}
            label="주문"
            active={section === "orders"}
            onClick={() => setSection("orders")}
          />
          <Nav
            icon={Sparkles}
            label="알림 소리"
            active={section === "sound"}
            onClick={() => setSection("sound")}
          />
          <Nav
            icon={BarChart3}
            label="분석"
            active={section === "analytics"}
            onClick={() => setSection("analytics")}
          />
          <Nav
            icon={Settings}
            label="설정"
            active={section === "settings"}
            onClick={() => setSection("settings")}
          />
        </nav>
        <div className="sidebar-bottom">
          <button>
            <CircleHelp size={19} /> 도움말
          </button>
          <div className="profile">
            <span>MC</span>
            <div>
              <b>민지 크림</b>
              <small>Owner</small>
            </div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>
      <main className="workspace">
        <Panel
          section={section}
          setSection={setSection}
          data={data}
          setData={setData}
          updateStore={updateStore}
          orders={orders}
          setOrders={setOrders}
        />
        <section className="preview-area">
          <div className="preview-toolbar">
            <div>
              <b>실시간 미리보기</b>
              <span>변경사항이 바로 반영돼요</span>
            </div>
            <div className="device-toggle">
              <button
                className={device === "phone" ? "on" : ""}
                onClick={() => setDevice("phone")}
              >
                <Smartphone size={16} />
              </button>
              <button
                className={device === "tablet" ? "on" : ""}
                onClick={() => setDevice("tablet")}
              >
                <Monitor size={17} />
              </button>
            </div>
          </div>
          <div className={`device-stage ${device}`}>
            <div className="device-shell">
              <Kiosk data={data} embedded />
            </div>
          </div>
        </section>
      </main>
      {published && (
        <div className="toast">
          <span>
            <Check size={18} />
          </span>
          <div>
            <b>성공적으로 게시했어요</b>
            <small>키오스크가 최신 버전으로 업데이트되었습니다.</small>
          </div>
        </div>
      )}
      {exportInfo && (
        <ExportModal links={exportInfo} onClose={() => setExportInfo(null)} />
      )}
    </div>
  );
}

function Nav({ icon: Icon, label, active, onClick }) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      <Icon size={19} />
      <span>{label}</span>
    </button>
  );
}

function Panel({
  section,
  setSection,
  data,
  setData,
  updateStore,
  orders = [],
  setOrders,
}) {
  const [editId, setEditId] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  if (section === "menu") {
    const addCategory = () => {
      const name = newCategory.trim();
      if (!name || data.categories.includes(name)) return;
      setData((d) => ({ ...d, categories: [...d.categories, name] }));
      setNewCategory("");
    };
    return (
      <div className="control-panel">
        <div className="panel-heading">
          <div>
            <span>콘텐츠</span>
            <h1>메뉴 관리</h1>
          </div>
          <button
            className="square"
            title="새 메뉴"
            onClick={() => {
              const id = Date.now();
              setData((d) => ({
                ...d,
                items: [
                  ...d.items,
                  {
                    id,
                    category: d.categories[1] || "기타",
                    name: "새로운 메뉴",
                    en: "New Menu",
                    desc: "메뉴 설명을 입력하세요",
                    price: 5000,
                    emoji: "🍧",
                    color: "#d9c2ec",
                    badge: "NEW",
                    soldout: false,
                    ingredientIds: [],
                    temperatureMode: "both",
                    shotsEnabled: true,
                    hotShots: true,
                    iceShots: true,
                    sizesEnabled: true,
                    smallPrice: 4500,
                    largePrice: 5000,
                  },
                ],
              }));
              setEditId(id);
            }}
          >
            <Plus size={18} />
          </button>
        </div>
        <p className="panel-copy">
          판매할 메뉴와 가격, 품절 상태를 관리하세요.
        </p>
        <div className="category-manager">
          <b>카테고리</b>
          <div>
            {data.categories
              .filter((c) => c !== "전체")
              .map((c) => (
                <span key={c}>
                  {c}
                  <button
                    title="카테고리 삭제"
                    disabled={data.items.some((i) => i.category === c)}
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        categories: d.categories.filter((x) => x !== c),
                      }))
                    }
                  >
                    <X />
                  </button>
                </span>
              ))}
          </div>
          <label>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="새 카테고리"
            />
            <button onClick={addCategory}>
              <Plus />
            </button>
          </label>
        </div>
        <div className="menu-count">
          <span>전체 메뉴</span>
          <b>{data.items.length}개</b>
        </div>
        <div className="menu-list">
          {data.items.length ? (
            data.items.map((item) => (
              <div
                className="menu-row"
                key={item.id}
                onClick={() => setEditId(item.id)}
              >
                <span style={{ background: item.color }}>{item.emoji}</span>
                <div>
                  <b>{item.name}</b>
                  <small>
                    {won(item.price)} · {item.category}
                  </small>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setData((d) => ({
                      ...d,
                      items: d.items.map((x) =>
                        x.id === item.id ? { ...x, soldout: !x.soldout } : x,
                      ),
                    }));
                  }}
                  className={isMenuSoldOut(item, data.store) ? "soldout" : ""}
                >
                  {item.soldout
                    ? "수동 품절"
                    : isMenuSoldOut(item, data.store)
                      ? "재료 소진"
                      : "판매중"}
                </button>
              </div>
            ))
          ) : (
            <div className="empty-card">
              <Coffee />
              <b>등록된 메뉴가 없어요</b>
              <p>오른쪽 위 + 버튼으로 첫 메뉴를 추가하세요.</p>
            </div>
          )}
        </div>
        {editId && (
          <ItemEditor
            item={data.items.find((x) => x.id === editId)}
            categories={data.categories}
            ingredients={data.store.ingredients || []}
            onClose={() => setEditId(null)}
            onChange={(p) =>
              setData((d) => ({
                ...d,
                items: d.items.map((x) =>
                  x.id === editId ? { ...x, ...p } : x,
                ),
              }))
            }
            onDelete={() => {
              setData((d) => ({
                ...d,
                items: d.items.filter((x) => x.id !== editId),
              }));
              setEditId(null);
            }}
          />
        )}
      </div>
    );
  }
  if (section === "orders")
    return (
      <OperationsPanel
        orders={orders}
        setOrders={setOrders}
        data={data}
        setData={setData}
      />
    );
  if (section === "ingredients")
    return <IngredientPanel data={data} setData={setData} />;
  if (section === "media")
    return (
      <MediaPanel data={data} setData={setData} updateStore={updateStore} />
    );
  if (section === "analytics") return <AnalyticsPanel orders={orders} />;
  if (section === "sound")
    return <SoundPanel data={data} updateStore={updateStore} />;
  if (section === "settings")
    return (
      <SettingsPanel data={data} setData={setData} updateStore={updateStore} />
    );
  return (
    <div className="control-panel">
      <div className="panel-heading">
        <div>
          <span>스타일</span>
          <h1>브랜드 디자인</h1>
        </div>
      </div>
      <p className="panel-copy">
        매장의 분위기가 자연스럽게 느껴지도록 꾸며보세요.
      </p>
      <h3 className="section-title">테마</h3>
      <div className="theme-grid">
        <Theme
          name="Soft Cream"
          colors={["#fff9ef", "#ff6b35", "#27231f"]}
          active={data.store.theme === "cream"}
          onClick={() => updateStore({ theme: "cream" })}
        />
        <Theme
          name="Night Scoop"
          colors={["#191919", "#e8ff72", "#f8f7f2"]}
          active={data.store.theme === "dark"}
          onClick={() => updateStore({ theme: "dark" })}
        />
        <Theme
          name="Berry Pop"
          colors={["#fff1f5", "#e63b6f", "#541d32"]}
          active={data.store.theme === "berry"}
          onClick={() => updateStore({ theme: "berry" })}
        />
      </div>
      <h3 className="section-title">브랜드 컬러</h3>
      <div className="color-setting">
        <label style={{ background: data.store.accent }}>
          <input
            type="color"
            value={data.store.accent}
            onChange={(e) => updateStore({ accent: e.target.value })}
          />
        </label>
        <div>
          <b>{data.store.accent.toUpperCase()}</b>
          <small>메인 버튼과 포인트에 사용돼요</small>
        </div>
      </div>
      <h3 className="section-title">모서리 스타일</h3>
      <div className="range-label">
        <span>또렷하게</span>
        <span>부드럽게</span>
      </div>
      <input
        className="range"
        type="range"
        min="4"
        max="32"
        value={data.store.radius}
        onChange={(e) => updateStore({ radius: +e.target.value })}
      />
      <h3 className="section-title">브랜드 메시지</h3>
      <Field label="매장 이름">
        <input
          value={data.store.name}
          onChange={(e) => updateStore({ name: e.target.value })}
        />
      </Field>
      <Field label="한 줄 소개">
        <textarea
          value={data.store.tagline}
          onChange={(e) => updateStore({ tagline: e.target.value })}
        />
      </Field>
      <div className="tip">
        <Sparkles />
        <div>
          <b>디자인 팁</b>
          <p>
            대표 색상은 버튼과 강조 요소에 사용돼요. 브랜드와 대비되는 색을
            고르면 더 선명해집니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({ title, subtitle, children }) {
  return (
    <div className="control-panel">
      <div className="panel-heading">
        <div>
          <span>관리</span>
          <h1>{title}</h1>
        </div>
      </div>
      <p className="panel-copy">{subtitle}</p>
      {children}
    </div>
  );
}
function MediaPanel({ data, setData, updateStore }) {
  const [editId, setEditId] = useState(null);
  return (
    <InfoPanel
      title="로고·음식 사진"
      subtitle="사진은 무료 저장을 위해 자동으로 압축되고 소비자 화면에 바로 반영됩니다."
    >
      <h3 className="section-title">매장 로고</h3>
      <ImageUpload
        logo
        value={data.store.logo}
        onChange={(logo) => updateStore({ logo })}
        label="매장 로고 선택"
      />
      <h3 className="section-title">메뉴 사진</h3>
      <div className="media-menu-list">
        {data.items.map((item) => (
          <button key={item.id} onClick={() => setEditId(item.id)}>
            <span style={{ background: item.color }}>
              {item.image ? <img src={item.image} alt="" /> : item.emoji}
            </span>
            <div>
              <b>{item.name}</b>
              <small>
                {item.image ? "사진 등록됨" : "사진을 추가해 보세요"}
              </small>
            </div>
            <ChevronRight />
          </button>
        ))}
      </div>
      {editId && (
        <ItemEditor
          item={data.items.find((x) => x.id === editId)}
          categories={data.categories}
          ingredients={data.store.ingredients || []}
          onClose={() => setEditId(null)}
          onChange={(patch) =>
            setData((current) => ({
              ...current,
              items: current.items.map((item) =>
                item.id === editId ? { ...item, ...patch } : item,
              ),
            }))
          }
          onDelete={() => {
            setData((current) => ({
              ...current,
              items: current.items.filter((item) => item.id !== editId),
            }));
            setEditId(null);
          }}
        />
      )}
    </InfoPanel>
  );
}
function SoundPanel({ data, updateStore }) {
  const [busy, setBusy] = useState(false);
  const contextRef = useRef(null);
  const store = data.store;
  const selected = store.notificationSound || "bell";
  const preview = (patch) =>
    playNotificationSound({ ...store, ...patch }, contextRef);
  const choose = (sound) => {
    updateStore({ notificationSound: sound });
    preview({ notificationSound: sound });
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const notificationAudio = await readAlertMp3(file);
      updateStore({ notificationAudio, notificationSound: "custom" });
      preview({ notificationAudio, notificationSound: "custom" });
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };
  return (
    <InfoPanel
      title="새 주문 알림 소리"
      subtitle="주문이 도착했을 때 확실히 들을 수 있도록 소리와 볼륨을 설정하세요."
    >
      <div className="sound-status">
        <Sparkles />
        <div>
          <b>강한 알림 모드</b>
          <small>기본 알림도 이전보다 더 크고 약 1.4초 동안 재생됩니다.</small>
        </div>
        <button onClick={() => preview({})}>미리 듣기</button>
      </div>
      <h3 className="section-title">기본 알림음</h3>
      <div className="sound-grid">
        {[
          ["bell", "선명한 벨", "맑고 높게 3번"],
          ["chime", "부드러운 차임", "점점 높아지는 음"],
          ["urgent", "강한 주문 알림", "분명하게 반복되는 음"],
        ].map(([value, name, desc]) => (
          <button
            key={value}
            className={selected === value ? "on" : ""}
            onClick={() => choose(value)}
          >
            <i>{selected === value ? <Check /> : "♪"}</i>
            <span>
              <b>{name}</b>
              <small>{desc}</small>
            </span>
            <em>듣기</em>
          </button>
        ))}
      </div>
      <h3 className="section-title">알림 볼륨</h3>
      <div className="sound-volume">
        <span>작게</span>
        <input
          type="range"
          min="10"
          max="100"
          value={Math.round((store.notificationVolume ?? 0.8) * 100)}
          onChange={(event) =>
            updateStore({
              notificationVolume: Number(event.target.value) / 100,
            })
          }
          onMouseUp={() => preview({})}
          onTouchEnd={() => preview({})}
        />
        <b>{Math.round((store.notificationVolume ?? 0.8) * 100)}%</b>
      </div>
      <h3 className="section-title">내 MP3 사용</h3>
      <div className={`custom-sound ${selected === "custom" ? "on" : ""}`}>
        <div>
          <Upload />
          <span>
            <b>
              {store.notificationAudio
                ? "등록한 MP3 알림음"
                : "MP3 파일을 선택하세요"}
            </b>
            <small>2초 미만 · 최대 350KB · 프로젝트에 무료 저장</small>
          </span>
        </div>
        <label>
          {busy
            ? "길이 확인 중..."
            : store.notificationAudio
              ? "MP3 변경"
              : "MP3 선택"}
          <input
            type="file"
            accept="audio/mpeg,.mp3"
            disabled={busy}
            onChange={upload}
          />
        </label>
        {store.notificationAudio && (
          <>
            <button onClick={() => choose("custom")}>
              {selected === "custom" ? "사용 중" : "이 소리 사용"}
            </button>
            <button
              className="remove"
              onClick={() =>
                updateStore({
                  notificationAudio: "",
                  notificationSound: "bell",
                })
              }
            >
              <Trash2 /> 제거
            </button>
          </>
        )}
      </div>
      <div className="sound-guide">
        <b>소리가 들리지 않을 때</b>
        <p>
          브라우저의 자동재생 정책 때문에 판매자 화면을 연 뒤 한 번은 화면을
          눌러야 합니다. 기기 자체 음량과 브라우저 탭 음소거도 확인해 주세요.
        </p>
      </div>
    </InfoPanel>
  );
}

function SettingsPanel({ data, setData, updateStore }) {
  const [department, setDepartment] = useState("");
  const departments = data.store.departments || [];
  const add = () => {
    const name = department.trim();
    if (!name || departments.includes(name)) return;
    updateStore({ departments: [...departments, name] });
    setDepartment("");
  };
  return (
    <InfoPanel
      title="프로젝트 설정"
      subtitle="매장 운영 방식과 주문 옵션을 직접 설정하세요."
    >
      <Field label="매장 이름">
        <input
          value={data.store.name}
          onChange={(e) => updateStore({ name: e.target.value })}
        />
      </Field>
      <Field label="소개 문구">
        <textarea
          value={data.store.tagline}
          onChange={(e) => updateStore({ tagline: e.target.value })}
        />
      </Field>
      <Field label="기본 샷 1회 가격">
        <input
          type="number"
          min="0"
          step="100"
          value={data.store.shotPrice ?? 500}
          onChange={(e) =>
            updateStore({ shotPrice: Math.max(0, +e.target.value) })
          }
        />
      </Field>
      <h3 className="section-title">주문 부서</h3>
      <p className="setting-help">
        부서가 하나 이상 등록되면 소비자가 주문할 때 반드시 선택해야 합니다.
      </p>
      <div className="department-editor">
        {departments.map((name, index) => (
          <div key={`${name}-${index}`}>
            <input
              value={name}
              onChange={(e) =>
                updateStore({
                  departments: departments.map((x, i) =>
                    i === index ? e.target.value : x,
                  ),
                })
              }
            />
            <button
              onClick={() =>
                updateStore({
                  departments: departments.filter((_, i) => i !== index),
                })
              }
            >
              <Trash2 />
            </button>
          </div>
        ))}
        <label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="예: 관리부, 중고등부"
          />
          <button onClick={add}>
            <Plus /> 추가
          </button>
        </label>
      </div>
      <div className="settings-card">
        <Store />
        <div>
          <b>
            {departments.length
              ? "소비자 부서 선택 사용 중"
              : "부서 선택 사용 안 함"}
          </b>
          <small>
            {departments.length
              ? `${departments.length}개 부서가 주문 화면에 표시됩니다.`
              : "부서를 추가하면 자동으로 활성화됩니다."}
          </small>
        </div>
      </div>
    </InfoPanel>
  );
}
function IngredientPanel({ data, setData }) {
  const [name, setName] = useState("");
  const ingredients = data.store.ingredients || [];
  const update = (next) =>
    setData((d) => ({ ...d, store: { ...d.store, ingredients: next } }));
  const add = () => {
    const value = name.trim();
    if (!value) return;
    update([
      ...ingredients,
      { id: `ingredient-${Date.now()}`, name: value, available: true },
    ]);
    setName("");
  };
  const remove = (id) => {
    if (
      data.items.some((i) => (i.ingredientIds || []).includes(id)) &&
      !confirm("이 재료를 사용하는 메뉴가 있습니다. 그래도 삭제할까요?")
    )
      return;
    update(ingredients.filter((x) => x.id !== id));
    setData((d) => ({
      ...d,
      items: d.items.map((i) => ({
        ...i,
        ingredientIds: (i.ingredientIds || []).filter((x) => x !== id),
      })),
    }));
  };
  return (
    <InfoPanel
      title="재료·재고 관리"
      subtitle="재료가 소진되면 연결된 모든 메뉴가 즉시 SOLD OUT 처리됩니다."
    >
      <div className="ingredient-summary">
        <Package />
        <div>
          <b>
            {ingredients.filter((i) => i.available).length} /{" "}
            {ingredients.length}
          </b>
          <small>판매 가능한 재료</small>
        </div>
      </div>
      <div className="ingredient-list">
        {ingredients.map((ingredient) => (
          <article
            key={ingredient.id}
            className={!ingredient.available ? "empty" : ""}
          >
            <button
              className="stock-toggle"
              onClick={() =>
                update(
                  ingredients.map((x) =>
                    x.id === ingredient.id
                      ? { ...x, available: !x.available }
                      : x,
                  ),
                )
              }
            >
              <i>{ingredient.available && <Check />}</i>
              <span>
                <b>{ingredient.name}</b>
                <small>
                  {ingredient.available ? "재고 있음" : "소진 · 연결 메뉴 품절"}
                </small>
              </span>
            </button>
            <button
              className="ingredient-delete"
              onClick={() => remove(ingredient.id)}
            >
              <Trash2 />
            </button>
          </article>
        ))}
      </div>
      <div className="ingredient-add">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="새 재료 이름"
        />
        <button onClick={add}>
          <Plus /> 재료 추가
        </button>
      </div>
    </InfoPanel>
  );
}
function MenuPicker({ items, store, onClose, onSelect }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="menu-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <small>REGISTERED MENUS</small>
            <h2>수정할 메뉴를 선택하세요</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <p>
          새 메뉴를 만드는 화면이 아닙니다. 현재 등록된 메뉴 중 하나를 골라
          수정합니다.
        </p>
        <div>
          {items.map((item) => (
            <button key={item.id} onClick={() => onSelect(item.id)}>
              <span style={{ background: item.color }}>{item.emoji}</span>
              <div>
                <b>{item.name}</b>
                <small>
                  {item.category} · {won(item.largePrice ?? item.price)}
                </small>
              </div>
              {isMenuSoldOut(item, store) && <i>SOLD OUT</i>}
              <ChevronRight />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function OperationsPanel({ orders, setOrders, data, setData }) {
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [payment, setPayment] = useState("prepaid");
  const [editId, setEditId] = useState(null);
  const [picker, setPicker] = useState(false);
  const [filter, setFilter] = useState("waiting");
  const labels = {
    new: "대기",
    preparing: "준비 중",
    completed: "판매완료",
    done: "판매완료",
    cancelled: "취소",
    refunded: "환불",
  };
  const shown = orders.filter(
    (o) =>
      filter === "all" ||
      (filter === "waiting" && ["new", "preparing"].includes(o.status)) ||
      (filter === "completed" && ["completed", "done"].includes(o.status)) ||
      (filter === "cancelled" && ["cancelled", "refunded"].includes(o.status)),
  );
  const update = async (id, status, extra = {}) => {
    try {
      const result = await api(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...extra }),
      });
      setOrders((list) =>
        list.map((o) =>
          o.id === id
            ? {
                ...o,
                status,
                total: result.total ?? o.total,
                payment_method: extra.paymentMethod || o.payment_method,
                completed_at:
                  status === "completed"
                    ? new Date().toISOString()
                    : o.completed_at,
              }
            : o,
        ),
      );
    } catch (e) {
      alert(e.message);
    }
  };
  const complete = async () => {
    await update(paymentOrder.id, "completed", { paymentMethod: payment });
    setPaymentOrder(null);
    setPayment("prepaid");
  };
  const exportRows = (department) => {
    const list = orders.filter(
      (o) =>
        (o.status === "completed" || o.status === "done") &&
        (!department || o.department === department),
    );
    const rows = [
      [
        "주문번호",
        "부서",
        "주문자",
        "메뉴",
        "온도",
        "사이즈",
        "샷",
        "수량",
        "금액",
        "결제수단",
        "주문시각",
        "완료시각",
        "환불시각",
        "환불사유",
        "결제시도횟수",
      ],
    ];
    list.forEach((o) =>
      o.items.forEach((i) =>
        rows.push([
          o.id.slice(0, 8),
          o.department || "",
          o.customer_name,
          i.name,
          i.temperature || "",
          i.size || "",
          i.shots || 0,
          i.qty,
          i.price * i.qty,
          {
            cash: "현금",
            prepaid: "선금",
            transfer: "계좌이체",
            coupon: "쿠폰",
          }[o.payment_method] || "",
          o.created_at,
          o.completed_at || "",
          o.refunded_at || "",
          o.refund_reason || "",
          o.payment_attempt_count || 0,
        ]),
      ),
    );
    const csv =
      "\ufeff" +
      rows
        .map((row) =>
          row
            .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = `GENO-${department || "전체"}-판매내역.csv`;
    a.click();
  };
  return (
    <InfoPanel
      title="주문 관리"
      subtitle="주문 접수부터 판매완료, 결제수단, 부서별 엑셀까지 관리하세요."
    >
      <div className="order-toolbar">
        <button onClick={() => exportRows("")}>
          <Download /> 전체 엑셀
        </button>
        {(data.store.departments || []).map((d) => (
          <button key={d} onClick={() => exportRows(d)}>
            {d} 엑셀
          </button>
        ))}
      </div>
      <div className="order-tabs">
        {[
          ["waiting", "대기 주문"],
          ["completed", "판매완료"],
          ["cancelled", "취소·환불"],
          ["all", "전체"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={filter === v ? "on" : ""}
            onClick={() => setFilter(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="order-list">
        {shown.map((o) => (
          <article key={o.id} className={o.status === "new" ? "new" : ""}>
            <div>
              <span>
                #{o.id.slice(0, 4).toUpperCase()} · {labels[o.status]}
              </span>
              <time>
                {new Date(o.created_at + "Z").toLocaleString("ko-KR")}
              </time>
            </div>
            <b>
              {o.customer_name} {o.department && `· ${o.department}`} ·{" "}
              {o.dining_type}
            </b>
            <div className="order-items">
              {o.items.map((i) => (
                <div key={`${o.id}-${i.id}`}>
                  <span>
                    {i.emoji} {i.name} · {i.temperature || "-"} ·{" "}
                    {i.size || "-"} · 샷 {i.shots || 0}회 × {i.qty}
                  </span>
                  {data.items.some((x) => String(x.id) === String(i.id)) && (
                    <button onClick={() => setPicker(true)}>
                      메뉴 선택·수정
                    </button>
                  )}
                </div>
              ))}
            </div>
            <strong>{won(o.total)}</strong>
            {(o.payment_method || o.payment_attempt_count || o.refunded_at) && (
              <div className="order-audit">
                <span>
                  결제{" "}
                  {{
                    cash: "현금",
                    prepaid: "선금",
                    transfer: "계좌이체",
                    coupon: "쿠폰",
                  }[o.payment_method] || "-"}
                </span>
                <span>결제시도 {o.payment_attempt_count || 0}회</span>
                {o.completed_at && (
                  <span>
                    완료{" "}
                    {new Date(o.completed_at + "Z").toLocaleTimeString("ko-KR")}
                  </span>
                )}
                {o.refunded_at && (
                  <span>
                    환불{" "}
                    {new Date(o.refunded_at + "Z").toLocaleTimeString("ko-KR")}
                  </span>
                )}
              </div>
            )}
            <div className="order-actions">
              {o.status === "new" && (
                <button onClick={() => update(o.id, "preparing")}>
                  준비 시작
                </button>
              )}
              {["new", "preparing"].includes(o.status) && (
                <button
                  onClick={() => {
                    setPaymentOrder(o);
                    setPayment("prepaid");
                  }}
                >
                  <Check /> 판매완료
                </button>
              )}
              {(o.status === "completed" || o.status === "done") && (
                <button
                  className="refund"
                  onClick={() =>
                    (() => {
                      const reason = prompt(
                        "환불 사유를 입력하세요.",
                        "판매자 환불 처리",
                      );
                      return (
                        reason !== null && update(o.id, "refunded", { reason })
                      );
                    })()
                  }
                >
                  환불
                </button>
              )}
              {["new", "preparing"].includes(o.status) && (
                <button
                  className="cancel"
                  onClick={() =>
                    confirm("주문을 취소할까요?") && update(o.id, "cancelled")
                  }
                >
                  취소
                </button>
              )}
            </div>
          </article>
        ))}
        {!shown.length && (
          <div className="empty-card">
            <ShoppingBag />
            <b>해당 주문이 없습니다</b>
            <p>새 주문은 자동으로 이 화면에 표시됩니다.</p>
          </div>
        )}
      </div>
      {paymentOrder && (
        <div className="modal-backdrop" onClick={() => setPaymentOrder(null)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <span className="auth-kicker">COMPLETE SALE</span>
            <h2>결제수단을 선택하세요</h2>
            <p>
              #{paymentOrder.id.slice(0, 4).toUpperCase()} ·{" "}
              {won(paymentOrder.total)}
            </p>
            <div>
              {[
                ["cash", "현금"],
                ["prepaid", "선금"],
                ["transfer", "계좌이체"],
                ["coupon", "쿠폰"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  className={payment === v ? "on" : ""}
                  onClick={() => setPayment(v)}
                >
                  {l}
                  {v === "prepaid" && <small>기본</small>}
                  {payment === v && <Check />}
                </button>
              ))}
            </div>
            <button className="auth-submit" onClick={complete}>
              확인하고 판매완료
            </button>
            <button
              className="modal-cancel"
              onClick={() => setPaymentOrder(null)}
            >
              돌아가기
            </button>
          </div>
        </div>
      )}
      {picker && (
        <MenuPicker
          items={data.items}
          store={data.store}
          onClose={() => setPicker(false)}
          onSelect={(id) => {
            setPicker(false);
            setEditId(id);
          }}
        />
      )}
      {editId && (
        <ItemEditor
          item={data.items.find((x) => String(x.id) === String(editId))}
          categories={data.categories}
          ingredients={data.store.ingredients || []}
          onClose={() => setEditId(null)}
          onChange={(p) =>
            setData((d) => ({
              ...d,
              items: d.items.map((x) =>
                String(x.id) === String(editId) ? { ...x, ...p } : x,
              ),
            }))
          }
          onDelete={() => {
            setData((d) => ({
              ...d,
              items: d.items.filter((x) => String(x.id) !== String(editId)),
            }));
            setEditId(null);
          }}
        />
      )}
    </InfoPanel>
  );
}
function OrderPanel({ orders, setOrders, data, setData }) {
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState("");
  const change = async (id, status) => {
    setBusy(id);
    try {
      await api(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOrders((o) => o.map((x) => (x.id === id ? { ...x, status } : x)));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy("");
    }
  };
  const statusText = {
    new: "신규 주문",
    preparing: "준비 중",
    done: "완료",
    cancelled: "취소",
    refunded: "환불 완료",
  };
  const notify = () => {
    "Notification" in window
      ? Notification.requestPermission()
      : alert("이 브라우저는 시스템 알림을 지원하지 않습니다.");
  };
  return (
    <InfoPanel
      title="주문 관리"
      subtitle="새 주문은 약 2초 안에 자동으로 열리고 알림음이 재생돼요."
    >
      <button className="notify-btn" onClick={notify}>
        <Sparkles size={14} /> 화면 밖에서도 새 주문 알림 받기
      </button>
      <div className="stats">
        <Stat
          value={String(
            orders.filter(
              (o) => o.status !== "cancelled" && o.status !== "refunded",
            ).length,
          )}
          label="유효 주문"
        />
        <Stat
          value={won(
            orders
              .filter((o) => o.status === "completed" || o.status === "done")
              .reduce((s, o) => s + o.total, 0),
          )}
          label="완료 매출"
        />
      </div>
      {orders.length ? (
        <div className="order-list">
          {orders.map((o) => (
            <article key={o.id} className={o.status === "new" ? "new" : ""}>
              <div>
                <span>
                  #{o.id.slice(0, 4).toUpperCase()} · {statusText[o.status]}
                </span>
                <time>
                  {new Date(o.created_at + "Z").toLocaleString("ko-KR")}
                </time>
              </div>
              <b>
                {o.customer_name} · {o.dining_type}
              </b>
              <div className="order-items">
                {o.items.map((i) => (
                  <div key={`${o.id}-${i.id}-${i.option}`}>
                    <span>
                      {i.emoji} {i.name} · {i.option} × {i.qty}
                    </span>
                    {data.items.some((x) => String(x.id) === String(i.id)) && (
                      <button onClick={() => setPicker(true)}>
                        메뉴 선택·수정
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <strong>{won(o.total)}</strong>
              {(o.payment_method ||
                o.payment_attempt_count ||
                o.refunded_at) && (
                <div className="order-audit">
                  <span>
                    결제{" "}
                    {{
                      cash: "현금",
                      prepaid: "선금",
                      transfer: "계좌이체",
                      coupon: "쿠폰",
                    }[o.payment_method] || "-"}
                  </span>
                  <span>결제시도 {o.payment_attempt_count || 0}회</span>
                  {o.completed_at && (
                    <span>
                      완료{" "}
                      {new Date(o.completed_at + "Z").toLocaleTimeString(
                        "ko-KR",
                      )}
                    </span>
                  )}
                  {o.refunded_at && (
                    <span>
                      환불{" "}
                      {new Date(o.refunded_at + "Z").toLocaleTimeString(
                        "ko-KR",
                      )}
                    </span>
                  )}
                </div>
              )}
              <div className="order-actions">
                <select
                  disabled={busy === o.id}
                  value={o.status}
                  onChange={(e) => change(o.id, e.target.value)}
                >
                  <option value="new">신규 주문</option>
                  <option value="preparing">준비 중</option>
                  <option value="done">완료</option>
                  <option value="cancelled">취소</option>
                  <option value="refunded">환불 완료</option>
                </select>
                {o.status !== "done" && o.status !== "refunded" && (
                  <button onClick={() => change(o.id, "done")}>
                    <Check /> 완료
                  </button>
                )}
                {o.status === "done" && (
                  <button
                    className="refund"
                    onClick={() =>
                      confirm("이 주문을 환불 완료로 변경할까요?") &&
                      change(o.id, "refunded")
                    }
                  >
                    환불 처리
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-card">
          <ShoppingBag />
          <b>아직 새로운 주문이 없어요</b>
          <p>소비자 사이트에서 첫 주문을 진행해 보세요.</p>
        </div>
      )}
      {editId && (
        <ItemEditor
          item={data.items.find((x) => String(x.id) === String(editId))}
          categories={data.categories}
          ingredients={data.store.ingredients || []}
          onClose={() => setEditId(null)}
          onChange={(p) =>
            setData((d) => ({
              ...d,
              items: d.items.map((x) =>
                String(x.id) === String(editId) ? { ...x, ...p } : x,
              ),
            }))
          }
          onDelete={() => {
            setData((d) => ({
              ...d,
              items: d.items.filter((x) => String(x.id) !== String(editId)),
            }));
            setEditId(null);
          }}
        />
      )}
    </InfoPanel>
  );
}
function Stat({ value, label }) {
  return (
    <div>
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}
function AnalyticsPanel({ orders }) {
  const sales = orders.filter(
    (o) => o.status === "completed" || o.status === "done",
  );
  if (!sales.length)
    return (
      <InfoPanel
        title="매장 분석"
        subtitle="실제 판매 데이터만 정확하게 보여드려요."
      >
        <div className="analytics-wait">
          <BarChart3 />
          <b>판매 데이터가 아직 부족해요</b>
          <p>주문을 완료 처리하면 매출과 인기 메뉴 분석이 이곳에 나타납니다.</p>
          <span>완료된 주문 {sales.length}건</span>
        </div>
      </InfoPanel>
    );
  const revenue = sales.reduce((s, o) => s + o.total, 0);
  const quantities = sales
    .flatMap((o) => o.items)
    .reduce((m, i) => ({ ...m, [i.name]: (m[i.name] || 0) + i.qty }), {});
  const popular = Object.entries(quantities).sort((a, b) => b[1] - a[1])[0];
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const daily = Array(7).fill(0);
  sales.forEach((o) => daily[new Date(o.created_at + "Z").getDay()]++);
  const max = Math.max(...daily, 1);
  return (
    <InfoPanel
      title="매장 분석"
      subtitle="완료된 주문을 기준으로 계산한 실제 데이터입니다."
    >
      <div className="stats">
        <Stat value={won(revenue)} label="완료 매출" />
        <Stat
          value={won(Math.round(revenue / sales.length))}
          label="평균 주문 금액"
        />
      </div>
      <div className="popular-card">
        <span>가장 인기 있는 메뉴</span>
        <b>{popular?.[0] || "-"}</b>
        <small>{popular?.[1] || 0}개 판매</small>
      </div>
      <div className="chart">
        <div className="chart-head">
          <b>요일별 완료 주문</b>
          <span>{sales.length}건</span>
        </div>
        <div className="bars">
          {daily.map((count, i) => (
            <i
              key={i}
              style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
            >
              <small>{days[i]}</small>
            </i>
          ))}
        </div>
      </div>
    </InfoPanel>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function ImageUpload({
  value,
  onChange,
  label = "이미지 업로드",
  logo = false,
}) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onChange(
        await compressImage(file, logo ? 320 : 720, logo ? 30000 : 50000),
      );
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };
  return (
    <div className={`image-upload ${logo ? "logo-upload" : ""}`}>
      {value ? (
        <img src={value} alt="업로드 미리보기" />
      ) : (
        <div>
          <Upload />
          <span>{logo ? "LOGO" : "FOOD PHOTO"}</span>
        </div>
      )}
      <label>
        {busy ? "압축하는 중..." : value ? "사진 변경" : label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={pick}
          disabled={busy}
        />
      </label>
      {value && (
        <button type="button" onClick={() => onChange("")}>
          <Trash2 /> 제거
        </button>
      )}
      <small>무료 저장을 위해 자동으로 WebP 압축됩니다.</small>
    </div>
  );
}
function Theme({ name, colors, active, onClick }) {
  return (
    <button className={`theme ${active ? "selected" : ""}`} onClick={onClick}>
      <div>
        {colors.map((c, i) => (
          <i key={i} style={{ background: c }} />
        ))}
      </div>
      <span>{name}</span>
      {active && (
        <b>
          <Check size={12} />
        </b>
      )}
    </button>
  );
}
function ItemEditor({
  item,
  categories,
  ingredients = [],
  onChange,
  onClose,
  onDelete,
}) {
  if (!item) return null;
  const mode = item.temperatureMode || "both";
  const sizes = item.sizesEnabled !== false;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="editor-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <small>메뉴 및 주문 옵션 편집</small>
            <h2>{item.name}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="emoji-preview" style={{ background: item.color }}>
          {item.image ? <img src={item.image} alt="" /> : item.emoji}
        </div>
        <ImageUpload
          value={item.image}
          onChange={(image) => onChange({ image })}
          label="음식 사진 선택"
        />
        <div className="two">
          <Field label="사진이 없을 때 이모지">
            <input
              value={item.emoji}
              maxLength="4"
              onChange={(e) => onChange({ emoji: e.target.value })}
            />
          </Field>
          <Field label="기본 표시 가격">
            <input
              type="number"
              min="0"
              step="100"
              value={item.price}
              onChange={(e) =>
                onChange({ price: Math.max(0, +e.target.value) })
              }
            />
          </Field>
        </div>
        <Field label="메뉴 이름">
          <input
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field label="메뉴 설명">
          <textarea
            value={item.desc}
            onChange={(e) => onChange({ desc: e.target.value })}
          />
        </Field>
        <div className="ingredient-picker">
          <b>사용 재료</b>
          <p>소진된 재료가 하나라도 있으면 메뉴가 자동 품절됩니다.</p>
          <div>
            {ingredients.map((ingredient) => (
              <label
                key={ingredient.id}
                className={!ingredient.available ? "empty" : ""}
              >
                <input
                  type="checkbox"
                  checked={(item.ingredientIds || []).includes(ingredient.id)}
                  onChange={(e) =>
                    onChange({
                      ingredientIds: e.target.checked
                        ? [...(item.ingredientIds || []), ingredient.id]
                        : (item.ingredientIds || []).filter(
                            (id) => id !== ingredient.id,
                          ),
                    })
                  }
                />
                <span>{ingredient.name}</span>
                <small>{ingredient.available ? "재고 있음" : "소진"}</small>
              </label>
            ))}
          </div>
        </div>
        <div className="two">
          <Field label="카테고리">
            <select
              value={item.category}
              onChange={(e) => onChange({ category: e.target.value })}
            >
              {categories
                .filter((c) => c !== "전체")
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </Field>
          <Field label="배지">
            <select
              value={item.badge || ""}
              onChange={(e) => onChange({ badge: e.target.value })}
            >
              <option value="">없음</option>
              <option>BEST</option>
              <option>NEW</option>
              <option>HOT</option>
            </select>
          </Field>
        </div>
        <div className="option-config">
          <h3>온도 설정</h3>
          <div className="config-buttons">
            {[
              ["both", "HOT · ICE"],
              ["hot", "HOT 전용"],
              ["ice", "ICE 전용"],
              ["none", "선택 없음"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={mode === value ? "on" : ""}
                onClick={() =>
                  onChange({
                    temperatureMode: value,
                    shotsEnabled: value === "none" ? false : item.shotsEnabled,
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
          <h3>샷 설정</h3>
          <label className="config-check">
            <input
              type="checkbox"
              checked={!!item.shotsEnabled}
              disabled={mode === "none"}
              onChange={(e) =>
                onChange({
                  shotsEnabled: e.target.checked,
                  hotShots: e.target.checked,
                  iceShots: e.target.checked,
                })
              }
            />
            <span>이 메뉴에 샷 추가 허용</span>
          </label>
          {item.shotsEnabled && mode !== "none" && (
            <div className="two-check">
              <label>
                <input
                  type="checkbox"
                  checked={item.hotShots !== false}
                  disabled={mode === "ice"}
                  onChange={(e) => onChange({ hotShots: e.target.checked })}
                />{" "}
                HOT 샷 허용
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={item.iceShots !== false}
                  disabled={mode === "hot"}
                  onChange={(e) => onChange({ iceShots: e.target.checked })}
                />{" "}
                ICE 샷 허용
              </label>
            </div>
          )}
          <h3>사이즈 설정</h3>
          <label className="config-check">
            <input
              type="checkbox"
              checked={sizes}
              onChange={(e) => onChange({ sizesEnabled: e.target.checked })}
            />
            <span>S·L 사이즈 사용</span>
          </label>
          {sizes && (
            <div className="two">
              <Field label="S 가격">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={item.smallPrice ?? item.price}
                  onChange={(e) =>
                    onChange({ smallPrice: Math.max(0, +e.target.value) })
                  }
                />
              </Field>
              <Field label="L 가격">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={item.largePrice ?? item.price}
                  onChange={(e) =>
                    onChange({
                      largePrice: Math.max(0, +e.target.value),
                      price: Math.max(0, +e.target.value),
                    })
                  }
                />
              </Field>
            </div>
          )}
        </div>
        <Field label="이미지 배경색">
          <input
            type="color"
            value={item.color}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </Field>
        <div className="modal-actions">
          <button className="delete" onClick={onDelete}>
            <Trash2 size={16} /> 삭제
          </button>
          <button className="btn primary" onClick={onClose}>
            변경 완료
          </button>
        </div>
      </div>
    </div>
  );
}
function ProfileMenu({ user, onLogout, compact = false }) {
  const [open, setOpen] = useState(false);
  const [historyOrders, setHistoryOrders] = useState([]);
  const ref = useRef();
  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (open && user.role === "customer")
      api("/api/my-orders")
        .then((r) => setHistoryOrders(r.orders))
        .catch(() => {});
  }, [open, user.role]);
  return (
    <div className={`profile-menu ${compact ? "compact" : ""}`} ref={ref}>
      <button className="profile-trigger" onClick={() => setOpen(!open)}>
        <span>{user.name?.slice(0, 1) || "G"}</span>
        {!compact && (
          <>
            <div>
              <b>{user.name}</b>
              <small>{user.role === "seller" ? "판매자" : "고객"}</small>
            </div>
            <ChevronRight />
          </>
        )}
      </button>
      {open && (
        <div className="profile-popover">
          <div className="profile-cover">
            <span>{user.name?.slice(0, 1) || "G"}</span>
            <div>
              <b>{user.name}</b>
              <small>
                {user.role === "seller"
                  ? "GENO Stuido 판매자"
                  : "GENO Stuido 고객"}
              </small>
            </div>
          </div>
          <dl>
            <div>
              <dt>이메일</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>계정 유형</dt>
              <dd>{user.role === "seller" ? "판매자 계정" : "고객 계정"}</dd>
            </div>
            <div>
              <dt>로그인 상태</dt>
              <dd className="online">안전하게 연결됨</dd>
            </div>
          </dl>
          {user.role === "customer" && (
            <div className="mini-orders">
              <b>최근 주문</b>
              {historyOrders.length ? (
                historyOrders.slice(0, 3).map((o) => (
                  <div key={o.id}>
                    <span>
                      #{o.id.slice(0, 4).toUpperCase()} · {won(o.total)}
                    </span>
                    <small>
                      {
                        {
                          new: "접수됨",
                          preparing: "준비 중",
                          done: "완료",
                          cancelled: "취소",
                        }[o.status]
                      }
                    </small>
                  </div>
                ))
              ) : (
                <p>아직 주문 내역이 없습니다.</p>
              )}
            </div>
          )}
          <button className="profile-logout" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
function ExportModal({ links, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(links.customer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("아래 주소를 복사하세요.", links.customer);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <button className="k-close" onClick={onClose}>
          <X />
        </button>
        <div className="export-icon">
          <Check />
        </div>
        <span className="auth-kicker">STORE READY</span>
        <h2>소비자 사이트가 준비됐어요</h2>
        <p>
          아래 주소는 로그인 없이 바로 열립니다. Cloudflare에 배포한 주소라면
          다른 휴대폰과 컴퓨터에서도 계속 사용할 수 있습니다.
        </p>
        <div className="site-link customer single">
          <div>
            <ShoppingBag />
            <span>
              <b>소비자 주문 사이트</b>
              <small>고객에게 공유할 매장 전용 주소</small>
            </span>
          </div>
          <code>{links.customer}</code>
          <button onClick={copy}>{copied ? "복사됨" : "주소 복사"}</button>
        </div>
        <a
          className="open-store"
          href={links.customer}
          target="_blank"
          rel="noreferrer"
        >
          소비자 사이트 바로 열기 <ChevronRight />
        </a>
        <button className="auth-submit" onClick={onClose}>
          완료
        </button>
      </div>
    </div>
  );
}

function Kiosk({ data, embedded = false, onExit, onOrder }) {
  const [screen, setScreen] = useState("menu");
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [cart, setCart] = useState([]);
  const [dine, setDine] = useState("매장");
  const [orderNumber, setOrderNumber] = useState("127");
  const [paying, setPaying] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [department, setDepartment] = useState("");
  const [countdown, setCountdown] = useState(3);
  const orderRequestKey = useRef(crypto.randomUUID());
  const t = kioskText;
  const colors =
    data.store.theme === "dark"
      ? { bg: "#171717", surface: "#242424", text: "#f8f7f2", muted: "#aaa" }
      : data.store.theme === "berry"
        ? { bg: "#fff3f7", surface: "#fff", text: "#541d32", muted: "#956879" }
        : { bg: "#fffaf2", surface: "#fff", text: "#25221f", muted: "#8a8178" };
  const visible = useMemo(
    () =>
      data.items.filter(
        (i) =>
          (category === "전체" || i.category === category) &&
          (!query || i.name.includes(query)),
      ),
    [data.items, category, query],
  );
  const total = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const add = (item, options) => {
    const cartId = `${item.id}-${options.temperature}-${options.size}-${options.shots}`;
    setCart((c) => {
      const hit = c.find((x) => x.cartId === cartId);
      return hit
        ? c.map((x) => (x.cartId === cartId ? { ...x, qty: x.qty + 1 } : x))
        : [...c, { ...item, ...options, cartId, qty: 1 }];
    });
    setSelected(null);
  };
  const css = {
    "--accent": data.store.accent,
    "--kr": `${data.store.radius}px`,
    "--kbg": colors.bg,
    "--ksurface": colors.surface,
    "--ktext": colors.text,
    "--kmuted": colors.muted,
  };
  const reset = () => {
    setCart([]);
    setCustomerName("");
    setDepartment("");
    setDine("매장");
    setCategory("전체");
    setQuery("");
    orderRequestKey.current = crypto.randomUUID();
    setScreen("menu");
  };
  useEffect(() => {
    if (screen !== "success" || embedded) return;
    setCountdown(3);
    const timer = setInterval(
      () =>
        setCountdown((n) => {
          if (n <= 1) {
            clearInterval(timer);
            setTimeout(reset, 0);
            return 0;
          }
          return n - 1;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [screen, embedded]);
  const pay = async () => {
    if ((data.store.departments || []).length && !department) {
      alert("부서를 선택해 주세요.");
      return;
    }
    if (paying) return;
    setPaying(true);
    try {
      if (onOrder) {
        const result = await onOrder({
          items: cart.map(({ cartId, ...x }) => x),
          total,
          diningType: dine,
          customerName: customerName.trim() || "현장 고객",
          department,
          requestKey: orderRequestKey.current,
        });
        setOrderNumber(result.number);
      }
      setScreen("success");
    } catch (e) {
      alert(e.message);
    } finally {
      setPaying(false);
    }
  };
  if (screen === "success")
    return (
      <div
        className={`kiosk ${embedded ? "embedded" : ""} success-screen`}
        style={css}
      >
        <div className="success-icon">
          <Check />
        </div>
        <p>{t.received}</p>
        <h1>
          {t.number} <b>{orderNumber}</b>
        </h1>
        <span>{t.notified}</span>
        <div className="countdown">
          <b>{countdown}</b>
          <small>{t.reset(countdown)}</small>
        </div>
        <button onClick={reset}>{t.home}</button>
        {!embedded && onExit && (
          <button className="exit-preview" onClick={onExit}>
            <X />
          </button>
        )}
      </div>
    );
  return (
    <div className={`kiosk ${embedded ? "embedded" : ""}`} style={css}>
      <header className="kiosk-head">
        <div className="kiosk-logo">
          <span>
            {data.store.logo ? (
              <img src={data.store.logo} alt="매장 로고" />
            ) : (
              <Sparkles size={16} />
            )}
          </span>
          <div>
            <b>{data.store.name}</b>
            <small>{data.store.tagline}</small>
          </div>
        </div>
        <div className="kiosk-tools">
          <button
            onClick={() =>
              document.querySelector(".category-row input")?.focus()
            }
            aria-label={t.search}
          >
            <Search size={18} />
          </button>
          {!embedded && onExit && (
            <button onClick={onExit}>
              <X size={18} />
            </button>
          )}
        </div>
      </header>
      {screen === "menu" ? (
        <>
          <section className="hero">
            <div>
              <span>{t.heroTop}</span>
              <h1>
                {t.heroA}
                <br />
                <em>{t.heroB}</em>
                {t.heroC}
              </h1>
            </div>
            <div className="hero-art">
              🍧<i>✦</i>
            </div>
          </section>
          <div className="category-row">
            {data.categories.map((c) => (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
            <label>
              <Search size={16} />
              <input
                placeholder={t.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <section className="product-grid">
            {visible.map((item) => (
              <button
                className={`product ${isMenuSoldOut(item, data.store) ? "is-soldout" : ""}`}
                key={item.id}
                onClick={() =>
                  !isMenuSoldOut(item, data.store) && setSelected(item)
                }
              >
                <div
                  className="product-image"
                  style={{ background: item.color }}
                >
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <span>{item.emoji}</span>
                  )}
                  {item.badge && <b>{item.badge}</b>}
                  {isMenuSoldOut(item, data.store) && <i>{t.soldout}</i>}
                </div>
                <div className="product-info">
                  <small>
                    {
                      {
                        both: "HOT · ICE",
                        hot: "HOT",
                        ice: "ICE",
                        none: "온도 선택 없음",
                      }[item.temperatureMode || "both"]
                    }
                  </small>
                  <h3>{item.name}</h3>
                  <p>{item.desc}</p>
                  <strong>{won(item.largePrice ?? item.price)}</strong>
                </div>
              </button>
            ))}
          </section>
          <div className="kiosk-footer">
            <div>
              <span>
                {dine === "매장" ? t.dine : t.takeout} {t.order}
              </span>
              <button
                onClick={() => setDine(dine === "매장" ? "포장" : "매장")}
              >
                {t.change}
              </button>
            </div>
            <button
              className="cart-btn"
              disabled={!cart.length}
              onClick={() => setScreen("cart")}
            >
              <span>
                <ShoppingBag size={18} />
                <b>{cart.reduce((s, x) => s + x.qty, 0)}</b>
              </span>
              <strong>{cart.length ? won(total) : t.addPrompt}</strong>
              <ChevronRight />
            </button>
          </div>
        </>
      ) : (
        <CartScreen
          cart={cart}
          setCart={setCart}
          total={total}
          dine={dine}
          back={() => setScreen("menu")}
          pay={pay}
          paying={paying}
          customerName={customerName}
          setCustomerName={setCustomerName}
          departments={data.store.departments || []}
          department={department}
          setDepartment={setDepartment}
          t={t}
        />
      )}{" "}
      {selected && (
        <ProductModal
          item={selected}
          ingredients={data.store.ingredients || []}
          shotPrice={data.store.shotPrice ?? 500}
          close={() => setSelected(null)}
          add={(options) => add(selected, options)}
        />
      )}
    </div>
  );
}
function ProductModal({ item, ingredients, shotPrice, close, add }) {
  const mode = item.temperatureMode || "both";
  const [temperature, setTemperature] = useState(
    mode === "hot"
      ? "HOT"
      : mode === "ice"
        ? "ICE"
        : mode === "none"
          ? "NONE"
          : "",
  );
  const [size, setSize] = useState("L");
  const [shots, setShots] = useState(0);
  const sizes = item.sizesEnabled !== false;
  const shotAllowed =
    !!item.shotsEnabled &&
    temperature !== "NONE" &&
    (temperature === "HOT"
      ? item.hotShots !== false
      : temperature === "ICE"
        ? item.iceShots !== false
        : true);
  useEffect(() => {
    if (!shotAllowed && shots) setShots(0);
  }, [shotAllowed]);
  const base = sizes
    ? size === "L"
      ? (item.largePrice ?? item.price)
      : (item.smallPrice ?? item.price)
    : item.price;
  const finalPrice = base + shots * shotPrice;
  const increase = () => {
    if (!shotAllowed) {
      alert("이 메뉴 또는 선택한 온도에는 샷을 추가할 수 없습니다.");
      return;
    }
    if (shots >= 10 && !confirm("샷을 더 추가하시겠습니까?")) return;
    setShots((s) => s + 1);
  };
  const submit = () => {
    if (mode === "both" && !temperature) {
      alert("HOT 또는 ICE를 선택해 주세요.");
      return;
    }
    add({
      temperature,
      size: sizes ? size : "NONE",
      shots,
      shotPrice,
      price: finalPrice,
    });
  };
  return (
    <div className="k-modal-bg" onClick={close}>
      <div
        className="k-modal option-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="k-close" onClick={close}>
          <X />
        </button>
        <div className="k-product-art" style={{ background: item.color }}>
          {item.image ? <img src={item.image} alt={item.name} /> : item.emoji}
        </div>
        <h2>{item.name}</h2>
        <p>{item.desc}</p>
        {(item.ingredientIds || []).length > 0 && (
          <div className="consumer-ingredients">
            <b>사용 재료</b>
            <span>
              {(item.ingredientIds || [])
                .map((id) => ingredients.find((x) => x.id === id)?.name)
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        )}
        <div className="option-block">
          <div className="option-title">
            <b>온도</b>
            {mode === "both" && <span>필수</span>}
          </div>
          <div className="temperature-buttons">
            <button
              disabled={!["both", "hot"].includes(mode)}
              className={temperature === "HOT" ? "on hot" : ""}
              onClick={() => setTemperature("HOT")}
            >
              HOT
            </button>
            <button
              disabled={!["both", "ice"].includes(mode)}
              className={temperature === "ICE" ? "on ice" : ""}
              onClick={() => setTemperature("ICE")}
            >
              ICE
            </button>
            {mode === "none" && (
              <button disabled className="on">
                선택 없음
              </button>
            )}
          </div>
        </div>
        <div className="option-row">
          <div>
            <b>사이즈</b>
            <small>{sizes ? "기본 L" : "사용 안 함"}</small>
          </div>
          <button
            className="size-toggle"
            disabled={!sizes}
            onClick={() => setSize(size === "L" ? "S" : "L")}
          >
            {sizes ? size : "NONE"}
          </button>
        </div>
        <div className="option-row">
          <div>
            <b>샷 추가</b>
            <small>
              {shotAllowed ? `1회당 ${won(shotPrice)}` : "추가할 수 없는 메뉴"}
            </small>
          </div>
          <div className="shot-stepper">
            <button
              onClick={() => setShots((s) => Math.max(0, s - 1))}
              disabled={!shots}
            >
              <Minus />
            </button>
            <b>{shots}</b>
            <button onClick={increase}>
              <Plus />
            </button>
          </div>
        </div>
        <div className="live-price">
          <span>현재 최종 가격</span>
          <b>{won(finalPrice)}</b>
        </div>
        <button className="add-button" onClick={submit}>
          <span>1개 담기</span>
          <b>{won(finalPrice)}</b>
        </button>
      </div>
    </div>
  );
}
function CartScreen({
  cart,
  setCart,
  total,
  dine,
  back,
  pay,
  paying,
  customerName,
  setCustomerName,
  departments,
  department,
  setDepartment,
  t,
}) {
  return (
    <div className="cart-screen">
      <button className="back" onClick={back}>
        <ArrowLeft /> {t.back}
      </button>
      <div className="cart-layout">
        <section>
          <span className="eyebrow">YOUR ORDER</span>
          <h1>{t.check}</h1>
          <p>
            {dine} · {cart.reduce((s, x) => s + x.qty, 0)}개
          </p>
          <div className="cart-list">
            {cart.map((x) => (
              <div key={x.cartId}>
                <span style={{ background: x.color }}>{x.emoji}</span>
                <div>
                  <b>{x.name}</b>
                  <small>
                    {x.temperature} · {x.size} · 샷 {x.shots}회
                  </small>
                  <strong>{won(x.price * x.qty)}</strong>
                </div>
                <div className="qty">
                  <button
                    onClick={() =>
                      setCart((c) =>
                        c.flatMap((i) =>
                          i.cartId === x.cartId
                            ? i.qty === 1
                              ? []
                              : [{ ...i, qty: i.qty - 1 }]
                            : [i],
                        ),
                      )
                    }
                  >
                    <Minus />
                  </button>
                  <b>{x.qty}</b>
                  <button
                    onClick={() =>
                      setCart((c) =>
                        c.map((i) =>
                          i.cartId === x.cartId ? { ...i, qty: i.qty + 1 } : i,
                        ),
                      )
                    }
                  >
                    <Plus />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside>
          <h3>{t.payment}</h3>
          {departments.length > 0 && (
            <label className="customer-name required">
              <span>
                부서 <small>필수</small>
              </span>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">부서를 선택하세요</option>
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          )}
          <label className="customer-name">
            <span>
              {t.customer} <small>{t.optional}</small>
            </span>
            <input
              value={customerName}
              maxLength="30"
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t.namePlaceholder}
            />
          </label>
          <div>
            <span>{t.products}</span>
            <b>{won(total)}</b>
          </div>
          <hr />
          <div className="grand">
            <span>{t.total}</span>
            <b>{won(total)}</b>
          </div>
          <button onClick={pay} disabled={paying}>
            {paying ? (
              t.sending
            ) : (
              <>
                {t.submit} <ChevronRight />
              </>
            )}
          </button>
          <small>{t.paymentNote}</small>
        </aside>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
