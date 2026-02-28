require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const nodemailer = require("nodemailer");

/**
 * 1. Geeknews에서 당일 최신 인기글 5개 수집
 */
async function fetchGeekNewsTop5() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const url = `https://news.hada.io/past?day=${today}`;
  
  console.log(`🔍 Geeknews에서 오늘의 인기글 (${today})을 수집 중입니다...`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    
    const newsItems = [];
    $('.topic_row').each((i, el) => {
      const title = $(el).find('.topictitle a h1').text().trim();
      const link = $(el).find('.topictitle a').attr('href');
      const scoreText = $(el).find('.topicinfo span[id^="tp"]').text().trim();
      const score = parseInt(scoreText) || 0;
      const content = $(el).find('.topicdesc a').text().trim();
      const topicId = $(el).find('.topicinfo a.u').attr('href');
      const geeknewsLink = topicId ? 'https://news.hada.io/' + topicId : '';
      
      if (title && link) {
        newsItems.push({ title, link, score, content, geeknewsLink });
      }
    });

    if (newsItems.length === 0) {
      throw new Error("오늘의 Geeknews 데이터가 없습니다.");
    }

    // 점수 순으로 정렬 후 상위 5개 선택
    const top5 = newsItems.sort((a, b) => b.score - a.score).slice(0, 5);
    
    console.log(`✅ ${top5.length}개의 정예 인기글을 선정했습니다.`);

    return top5.map(r => `제목: ${r.title}\n원본 출처: ${r.link}\nGeeknews: ${r.geeknewsLink}\n인기 점수: ${r.score}\n내용 요약: ${r.content}`).join("\n\n---\n\n");
  } catch (error) {
    console.error("Geeknews 수집 실패:", error.message);
    throw error;
  }
}

/**
 * 2. Gemini 요약 (선정된 5개 소식에 대한 상세 기술 리포트)
 */
async function summarizeNews(rawText) {
  console.log("🤖 Gemini가 선정된 인기글을 상세하게 분석 중입니다...");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  
  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const prompt = `
오늘은 ${todayStr}입니다. 당신은 "Geeknews"의 오늘의 인기 기술 뉴스 5개를 심층 분석하여 전달하는 전문 기술 큐레이터입니다.

[지침]:
1. 제공된 "원문 데이터"는 오늘 Geeknews에서 가장 반응이 좋았던 상위 5개 게시글입니다.
2. 각 기사에 대해 다음 형식을 엄격히 지켜주세요:
   - [제목]
   - 링크: (Geeknews URL 제안)
   - [심층 분석 리포트]: 
     * 해당 기술/뉴스의 배경, 핵심 내용, 그리고 업계에 미칠 영향이나 기술적 가치를 포함하여 5~7문장 내외로 상세하게 설명하세요.
     * 단순히 요약하는 것을 넘어, 왜 이 소식이 중요한지 인사이트를 담아주세요.

3. [주의 사항]:
   - **인기 점수(Points)는 리포트에 포함하지 마세요.**
   - **링크는 Geeknews 주소 하나만 제공하세요.** (원본 URL은 생략)
   - **어떠한 마크다운 문법(특히 **글자 강조**)도 사용하지 마세요.**
   - 제목이나 강조하고 싶은 부분은 대괄호[]와 줄바꿈만 활용하세요.
   - 메일 가독성을 위해 순수 텍스트와 줄바꿈만 사용하세요.

[구성]:
- [오늘의 Geeknews 기술 인사이트 TOP 5 상세 리포트]
- (${todayStr} 기준)

[원문 데이터]:
${rawText}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini 요약 실패:", error);
    throw error;
  }
}

/**
 * 3. 이메일 발송 (Gmail SMTP)
 */
async function sendEmail(summary) {
  console.log("✉️ 뉴스레터를 이메일로 발송 중입니다...");
  
  // SMTP 설정
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD // 앱 비밀번호 사용 필수
    }
  });

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: `"바이브 코딩 뉴스레터" <${process.env.GMAIL_USER}>`,
    to: process.env.RECEIVER_EMAIL,
    subject: `[Daily Insight] ${today} 최신 Tech 리포트`,
    text: summary,
    // HTML 형식을 사용하고 싶다면 아래 주석 해제 후 처리 가능
    // html: summary.replace(/\n/g, '<br>') 
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ 메일 발송 성공:", info.messageId);
  } catch (error) {
    console.error("메일 발송 실패:", error);
    throw error;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    // 0. 환경 변수 체크
    const requiredEnv = ['GEMINI_API_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'RECEIVER_EMAIL'];
    const missing = requiredEnv.filter(k => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`누락된 환경 변수가 있습니다: ${missing.join(', ')}`);
    }

    // 1. 뉴스 수집
    const news = await fetchGeekNewsTop5();
    
    // 2. 뉴스 요약
    const summary = await summarizeNews(news);
    
    // 3. 이메일 발송
    // 요약 결과가 유의미할 때만 메일 발송
    if (summary && summary.trim().length > 30) {
      await sendEmail(summary);
      console.log("🎉 오늘의 정예 리포트 발송 완료!");
    } else {
      console.log("⚠️ 발송할 만한 최신 유의미한 소식이 없어 발송을 스킵합니다.");
    }
    
  } catch (error) {
    console.error("❌ 작업 도중 오류가 발생했습니다:", error.message);
    process.exit(1);
  }
}

main();
