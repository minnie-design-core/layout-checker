# 오토 레이아웃 검사기 (Auto Layout Checker)

Figma에서 Variable이 적용되지 않은 컬러 노드를 검색하고 표시하는 플러그인입니다.

## 기능

- Figma 디자인 파일에서 Variable이 적용되지 않은 컬러 속성을 자동으로 검사
- 선택한 노드 내에서만 검색하거나 전체 프레임에서 검색 가능
- 숨겨진 레이어 포함/제외 옵션 제공
- 검색된 노드 목록을 보기 쉽게 표시
- 해당 노드로 바로 이동하여 수정 가능

## 설치 방법

1. 이 저장소를 클론합니다:
   ```
   git clone https://github.com/your-username/layout-checker.git
   cd layout-checker
   ```

2. 의존성 패키지를 설치합니다:
   ```
   npm install
   ```

3. 개발 모드로 실행:
   ```
   npm run build
   ```
   또는 자동 빌드를 위해:
   ```
   npm run watch
   ```

4. Figma 앱에서 플러그인을 불러옵니다:
   - Figma 앱 열기
   - 우클릭 > 플러그인 > 개발 > '플러그인 가져오기'
   - manifest.json 파일 선택

## 사용 방법

1. Figma에서 검사하려는 프레임이나 요소 선택 (선택하지 않으면 전체 페이지 검사)
2. 플러그인 > 오토 레이아웃 검사기 실행
3. 검색 옵션 설정 후 '검색' 버튼 클릭
4. 검색 결과에서 항목을 클릭하면 해당 요소로 이동

## 개발 환경

- TypeScript
- Figma Plugin API
- HTML/CSS (UI)

## 프로젝트 구조

```
layout-checker/
├── dist/             # 컴파일된 플러그인 파일
├── src/              # 소스 코드
│   ├── code.ts       # 플러그인 메인 코드
│   └── ui.html       # 사용자 인터페이스
├── manifest.json     # Figma 플러그인 설정
├── package.json      # 프로젝트 의존성 및 스크립트
└── tsconfig.json     # TypeScript 설정
```

## 라이선스

MIT 라이선스 하에 배포됩니다.

## 제작자

- Minnie 