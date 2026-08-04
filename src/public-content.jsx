import React from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { AdSenseLoader, AdSlot, adsenseConfig } from "./adsense.jsx";
import "./public-content.css";

export const PUBLIC_CONTENT_PATHS = new Set(["/about", "/guide", "/privacy", "/terms"]);

const pageContent = {
  "/about": {
    eyebrow: "ABOUT GENO",
    title: "작은 매장의 주문 운영을 더 단순하게",
    intro: "GENO Stuido는 메뉴를 꾸미는 화면과 고객 주문, 품절 관리, 판매 기록을 한 흐름으로 연결하는 웹 도구입니다.",
    sections: [
      ["왜 만들었나요?", "작은 매장도 복잡한 장비나 별도 앱 없이 온라인 주문 화면을 만들고, 주문 상태를 한곳에서 관리할 수 있도록 만들었습니다."],
      ["무엇을 할 수 있나요?", "메뉴와 가격 설정, 온도·사이즈·샷 옵션, 재료별 자동 품절, 공개 주문 링크, 주문 준비·완료·환불 기록을 지원합니다."],
      ["어떻게 운영되나요?", "브라우저 화면은 Cloudflare Pages에서 제공되고 계정·프로젝트·주문 데이터는 연결된 Cloudflare D1에 저장됩니다. 주문 금액과 품절 여부는 최종 주문 시 서버가 다시 확인합니다."],
    ],
  },
  "/guide": {
    eyebrow: "OPERATION GUIDE",
    title: "처음부터 주문 완료까지, 4단계 안내",
    intro: "판매자가 실제 매장을 준비할 때 필요한 핵심 순서만 정리했습니다.",
    sections: [
      ["1. 판매자 계정 만들기", "로그인 화면에서 계정 이름과 8자 이상의 비밀번호를 정합니다. 복구 이메일 기능은 아직 없으므로 비밀번호를 안전하게 보관하세요."],
      ["2. 메뉴와 재료 설정하기", "카테고리와 메뉴를 만들고 가격·옵션을 확인합니다. 재료를 메뉴에 연결하면 재료 소진 시 해당 메뉴가 자동으로 품절됩니다."],
      ["3. 공개 주문 링크 확인하기", "프로젝트를 저장하고 공개 링크를 엽니다. 휴대전화에서 메뉴, 가격, 옵션과 품절 표시가 올바른지 직접 주문 전에 확인하세요."],
      ["4. 주문 처리하고 백업하기", "새 주문을 준비·판매완료·환불 상태로 처리합니다. 운영 종료 전 주문 CSV와 프로젝트 JSON을 내려받아 별도로 보관하는 것을 권장합니다."],
    ],
  },
  "/privacy": {
    eyebrow: "PRIVACY POLICY",
    title: "개인정보 처리방침",
    intro: "아래 내용은 현재 코드에서 확인한 실제 처리 흐름을 기준으로 작성했습니다. 운영자 정보와 정책 날짜는 서비스 운영자가 확정해야 합니다.",
    sections: [
      ["수집·처리하는 정보", "판매자 계정 이름과 암호화된 비밀번호 정보, 로그인 세션, 매장 프로젝트, 고객이 주문 시 입력한 이름·부서·주문 내용과 처리 기록을 서비스 제공 목적으로 처리합니다."],
      ["보관과 삭제", "계정·프로젝트·주문의 구체적인 보관 기간은 운영자가 확정해야 합니다. 만료된 로그인 세션은 인증 및 로그아웃 과정에서 정리됩니다."],
      ["외부 처리", "제휴 문의를 보내는 경우 입력한 회사·이름·이메일·문의 내용이 Formspree로 전달됩니다. AdSense를 활성화하면 Google 광고 관련 쿠키와 데이터 처리가 추가될 수 있으므로 동의 및 고지 정책을 별도로 확정해야 합니다."],
      ["운영자와 문의처", "[사용자 입력 필요] 서비스 운영자 또는 사업자명, 개인정보 보호 책임자, 문의 이메일, 사업장 소재지(해당하는 경우)를 입력해야 합니다."],
      ["시행일", "[사용자 입력 필요] 실제 공개 및 적용 날짜를 입력해야 합니다."],
    ],
  },
  "/terms": {
    eyebrow: "TERMS OF SERVICE",
    title: "서비스 이용 안내",
    intro: "현재 제공 기능의 범위와 이용 시 주의사항을 이해하기 쉽게 정리했습니다.",
    sections: [
      ["서비스 범위", "GENO Stuido는 메뉴 제작, 공개 주문 접수와 판매 상태 관리를 돕습니다. 실제 카드 결제, 배송, 세금계산서 발행 기능은 제공하지 않습니다."],
      ["판매자의 책임", "판매자는 메뉴 가격·알레르기·재료·품절 정보와 주문 처리 결과를 실제 매장 상황에 맞게 확인하고 고객에게 안내해야 합니다."],
      ["계정과 데이터", "계정 정보를 다른 사람과 공유하지 말고 프로젝트 JSON과 주문 CSV를 정기적으로 백업하세요. 서비스 장애나 무료 사용량 한도로 일시적인 요청 실패가 발생할 수 있습니다."],
      ["정책 확정 필요", "[사용자 입력 필요] 운영 주체, 적용일, 서비스 중단·계정 삭제·분쟁 처리 기준과 관할 법원을 실제 운영 정책에 맞게 확정해야 합니다."],
    ],
  },
};

export function PublicContentPage({ pathname = location.pathname, adConfig = adsenseConfig() }) {
  const page = pageContent[pathname];
  if (!page) return null;
  return (
    <div className="public-content-page">
      <AdSenseLoader pathname={pathname} config={adConfig} />
      <header className="content-nav">
        <a className="content-brand" href="/login" aria-label="GENO Stuido 홈">
          <span><Sparkles size={17} /></span><b>GENO Stuido</b>
        </a>
        <nav aria-label="공개 정보 페이지">
          <a href="/about">서비스 소개</a><a href="/guide">이용 안내</a><a href="/privacy">개인정보</a><a href="/terms">이용 정책</a>
        </nav>
      </header>
      <main id="main-content" className="content-main">
        <div className="content-hero">
          <span>{page.eyebrow}</span><h1>{page.title}</h1><p>{page.intro}</p>
        </div>
        <AdSlot pathname={pathname} config={adConfig} />
        <div className="content-sections">
          {page.sections.map(([title, copy]) => <section key={title}><h2>{title}</h2><p>{copy}</p></section>)}
        </div>
        <a className="content-start" href="/login">GENO 시작 화면으로 <ChevronRight /></a>
      </main>
      <footer className="content-footer">
        <span>© GENO Stuido</span><nav aria-label="법적 고지"><a href="/privacy">개인정보 처리방침</a><a href="/terms">이용 안내</a></nav>
      </footer>
    </div>
  );
}
