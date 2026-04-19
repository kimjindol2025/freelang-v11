# 배포 가이드

> FreeLang v11 애플리케이션을 Docker, Kubernetes, 클라우드 서비스에 배포하기

---

## 🐳 Docker 배포

### 1️⃣ Dockerfile 자동 생성

FreeLang의 선언형 인프라 블록으로 Dockerfile을 자동 생성합니다.

```lisp
;; app.fl
(dockerfile
  :from "node:20-slim"
  :workdir "/app"
  :env {"NODE_ENV" "production"}
  :copy "*.fl" "."
  :copy "package.json" "."
  :copy "bootstrap.js" "."
  :run "npm ci --only=production"
  :expose "3000"
  :cmd "node bootstrap.js serve --port 3000")

(println "✅ Dockerfile 생성됨")
```

실행:
```bash
node bootstrap.js run app.fl
# → Dockerfile 생성
```

**생성된 Dockerfile 예시**:
```dockerfile
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY *.fl .
COPY package.json .
COPY bootstrap.js .
RUN npm ci --only=production
EXPOSE 3000
CMD ["node", "bootstrap.js", "serve", "--port", "3000"]
```

### 2️⃣ 이미지 빌드 및 실행

```bash
# 이미지 빌드
docker build -t freelang-app:1.0 .

# 로컬 테스트
docker run -p 3000:3000 freelang-app:1.0

# 브라우저에서 접속
# http://localhost:3000
```

### 3️⃣ 레지스트리에 푸시

```bash
# Docker Hub
docker tag freelang-app:1.0 yourusername/freelang-app:1.0
docker push yourusername/freelang-app:1.0

# AWS ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag freelang-app:1.0 123456789.dkr.ecr.us-east-1.amazonaws.com/freelang-app:1.0
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/freelang-app:1.0
```

---

## ☸️ Kubernetes 배포

### 1️⃣ 매니페스트 자동 생성

FreeLang의 선언형 블록으로 Kubernetes YAML을 자동 생성합니다.

```lisp
;; k8s-deploy.fl
(deployment
  :name "freelang-app"
  :namespace "default"
  :image "yourusername/freelang-app:1.0"
  :replicas 3
  :port 3000
  :env {"NODE_ENV" "production"})

(service
  :name "freelang-app"
  :selector "app=freelang-app"
  :port 80
  :target-port 3000
  :type "LoadBalancer")

(ingress
  :name "freelang-app"
  :host "myapp.example.com"
  :service-name "freelang-app"
  :service-port 80)

(println "✅ Kubernetes 매니페스트 생성됨")
```

실행:
```bash
node bootstrap.js run k8s-deploy.fl
# → deployment.yaml, service.yaml, ingress.yaml 생성
```

### 2️⃣ 배포 실행

```bash
# 매니페스트 적용
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# 배포 상태 확인
kubectl get deployments
kubectl get services
kubectl get ingress

# Pod 상태 확인
kubectl get pods
kubectl logs <pod-name>

# 포트 포워딩 (테스트용)
kubectl port-forward svc/freelang-app 3000:80
```

### 3️⃣ 스케일링

```bash
# 복제본 수 변경
kubectl scale deployment freelang-app --replicas 5

# 롤링 업데이트
kubectl set image deployment/freelang-app \
  freelang-app=yourusername/freelang-app:2.0

# 업데이트 상태 확인
kubectl rollout status deployment/freelang-app

# 이전 버전으로 롤백
kubectl rollout undo deployment/freelang-app
```

---

## ☁️ 클라우드 배포

### AWS 배포

#### AWS S3 버킷 관리

```lisp
;; 파일 업로드
(aws-s3-upload
  :bucket "my-bucket"
  :key "uploads/file.txt"
  :data "Hello, AWS!")

;; 파일 다운로드
(aws-s3-download
  :bucket "my-bucket"
  :key "uploads/file.txt")

;; 파일 목록
(aws-s3-list
  :bucket "my-bucket"
  :prefix "uploads/")

;; 파일 삭제
(aws-s3-delete
  :bucket "my-bucket"
  :key "uploads/file.txt")
```

#### AWS Lambda 함수 호출

```lisp
(aws-lambda-invoke
  :function "my-function"
  :payload {:action "process" :data "input"})
```

**전제 조건**:
- AWS CLI 설치: `pip install awscli`
- AWS 자격증명 설정: `aws configure`
- IAM 권한: S3, Lambda 접근 권한

#### 예제: S3 기반 파일 서버

```lisp
;; aws-file-server.fl
(route-get "/files/{key}"
  (fn [req]
    (let [result (aws-s3-download
                   :bucket "my-bucket"
                   :key (get req :params :key))]
      (if (get result :status "error")
        (http-response :status 404 :body "Not found")
        (http-response :status 200 :body (get result :content))))))

(println "✅ AWS S3 파일 서버 시작")
```

### GCP Cloud Run 배포

```lisp
;; gcp-deploy.fl
(gcp-run-deploy
  :service "freelang-app"
  :image "gcr.io/my-project/freelang-app:1.0"
  :region "us-central1"
  :memory "512Mi"
  :cpu "1"
  :port 3000)

(println "✅ GCP Cloud Run 배포 완료")
```

**전제 조건**:
- Google Cloud SDK 설치: `curl https://sdk.cloud.google.com | bash`
- 프로젝트 설정: `gcloud config set project my-project`
- 자격증명 설정: `gcloud auth login`

### Azure Functions 배포

```lisp
;; azure-func.fl
(azure-function-invoke
  :function "my-function"
  :payload {:name "World"})

(println "✅ Azure Function 호출 완료")
```

**전제 조건**:
- Azure CLI 설치: `pip install azure-cli`
- 인증: `az login`

---

## 🔄 CI/CD 파이프라인

### GitHub Actions 자동 생성

```lisp
;; ci-cd.fl
(github-actions
  :name "CI/CD Pipeline"
  :on "push"
  :branches ["main"]
  :env {"NODE_ENV" "production"}
  :jobs [
    {:name "Test"
     :runs-on "ubuntu-latest"
     :steps [
       {:uses "actions/checkout@v3"}
       {:uses "actions/setup-node@v3" :with {:node-version "20"}}
       {:run "npm install"}
       {:run "npm test"}]}
    {:name "Build & Push"
     :runs-on "ubuntu-latest"
     :needs "Test"
     :steps [
       {:uses "docker/login-action@v2"
        :with {:username "${{ secrets.DOCKER_USERNAME }}"
               :password "${{ secrets.DOCKER_PASSWORD }}"}}
       {:uses "docker/build-push-action@v4"
        :with {:push true
               :tags "yourusername/freelang-app:latest"}}]}])

(println "✅ .github/workflows 생성됨")
```

생성 결과: `.github/workflows/ci-cd.yml`

---

## 📋 배포 체크리스트

### 배포 전 확인

- [ ] `npm test` 모두 통과 (637/637 PASS)
- [ ] `npm run build` 성공
- [ ] 환경 변수 설정 완료 (AWS_ACCESS_KEY_ID 등)
- [ ] 데이터베이스 마이그레이션 완료
- [ ] 로그 레벨 설정 (production은 INFO 이상)
- [ ] SSL/TLS 인증서 준비

### 배포 후 확인

- [ ] 서버 헬스 체크 성공
- [ ] 기본 API 엔드포인트 응답 확인
- [ ] 데이터베이스 연결 확인
- [ ] 외부 서비스 연동 확인
- [ ] 모니터링/로깅 시스템 작동 확인
- [ ] 백업 및 복구 계획 검증

---

## 🚀 배포 옵션 비교

| 옵션 | 설정 난이도 | 비용 | 확장성 | 추천 |
|------|-----------|------|--------|------|
| **Docker (로컬)** | 낮음 | 무료 | 낮음 | 개발/테스트 |
| **Kubernetes** | 높음 | 중간 | 높음 | 프로덕션 (대규모) |
| **AWS EC2** | 중간 | 중간 | 높음 | 엔터프라이즈 |
| **GCP Cloud Run** | 낮음 | 낮음 | 중간 | 시작/중규모 |
| **Azure App Service** | 낮음 | 낮음 | 중간 | Microsoft 환경 |

---

## 🆘 문제 해결

### Docker 빌드 실패
```bash
# 캐시 초기화
docker system prune -a
docker build --no-cache -t freelang-app:1.0 .
```

### Kubernetes Pod Crash
```bash
# 로그 확인
kubectl logs <pod-name>
kubectl describe pod <pod-name>

# 이벤트 확인
kubectl get events
```

### AWS CLI 인증 오류
```bash
# 자격증명 확인
aws sts get-caller-identity

# 재설정
aws configure
```

---

## 📚 추가 리소스

- [Docker 공식 문서](https://docs.docker.com/)
- [Kubernetes 시작하기](https://kubernetes.io/docs/setup/)
- [AWS 배포 가이드](https://docs.aws.amazon.com/deployment/)
- [GCP Cloud Run](https://cloud.google.com/run/docs)
- [Azure App Service](https://docs.microsoft.com/azure/app-service/)
