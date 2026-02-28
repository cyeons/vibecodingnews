# 🚀 Geeknews 오늘의 인기 TOP 5 뉴스레터

Geeknews(news.hada.io)에서 매일 가장 인기 있는 최신 기술 뉴스 5개를 수집하고 Gemini API로 요약하여 이메일로 보내주는 자동화 시스템입니다.

## 🛠 주요 기능

- **인기글 수집**: news.hada.io에서 당일 게시글 중 점수가 높은 상위 5개 추출
- **AI 요약**: Gemini 1.5 Flash를 사용하여 핵심 기술 인사이트 요약 생성
- **자동 발송**: 매일 아침 지정된 시간에 이메일(Gmail)로 뉴스레터 발송
- **무료 운영**: GitHub Actions를 활용하여 별도 서버 비용 없이 운영

## 📋 설정 방법

### 1. API 키 발급

- [Google Gemini API Key](https://aistudio.google.com/): 텍스트 요약용
- [Gmail 앱 비밀번호](https://myaccount.google.com/apppasswords): 메일 발송용 (기본 비밀번호는 작동하지 않습니다.)

### 2. 로컬 테스트

1. `.env.example` 파일을 복사하여 `.env` 파일을 만듭니다.
2. `.env` 파일에 각 API 키와 이메일 정보를 입력합니다.
3. 다음 명령어를 실행하여 테스트합니다:
   ```bash
   node index.js
   ```

### 3. GitHub Actions 자동화 설정 (실제 운영용)

GitHub 리포지토리에 소스를 올린 후, **Settings > Secrets and variables > Actions**에서 다음 Secret들을 등록해주세요:

- `GEMINI_API_KEY`: Gemini API 키
- `GMAIL_USER`: 뉴스레터를 보낼 Gmail 주소
- `GMAIL_APP_PASSWORD`: 위 Gmail의 앱 비밀번호
- `RECEIVER_EMAIL`: 뉴스레터를 받을 이메일 주소

## ⏰ 실행 스케줄

현재 `.github/workflows/daily-news.yml` 설정에 의해 **매일 한국 시간 오전 7시**에 자동으로 실행됩니다.

## 📄 라이선스

MIT
