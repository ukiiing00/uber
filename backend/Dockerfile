# Node.js 이미지 사용
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 소스 코드 복사
COPY . .

# 빌드
RUN npm run build

# 포트 노출
EXPOSE 3000

# 프로덕션 모드로 실행
CMD ["npm", "run", "start:prod"]

