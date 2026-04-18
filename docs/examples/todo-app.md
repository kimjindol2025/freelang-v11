# 예제: TODO 앱

간단한 할일 관리 웹 애플리케이션.

## 전체 코드

```lisp
(import flnext)

; 데이터 모델
[MODEL Todo
 :table "todos"
 :fields [
  {:name "id" :type "INTEGER" :primary-key true}
  {:name "title" :type "TEXT" :required true}
  {:name "completed" :type "BOOLEAN" :default false}
  {:name "created-at" :type "TIMESTAMP" :default "CURRENT_TIMESTAMP"}
 ]]

; 검증
[SCHEMA CreateTodoSchema
 :fields {
  :title {:type "string" :required true :min 1 :max 200}
 }]

; API 함수
(defn list-todos [req]
  (let [todos (todo/find-all)]
    {:status 200
     :body {:todos todos}}))

(defn create-todo [req]
  (let [data (:body req)]
    (if (schema-valid? CreateTodoSchema data)
      (let [todo (todo/create data)]
        {:status 201
         :body {:todo todo}})
      {:status 400
       :body {:error "Invalid input"}})))

(defn update-todo [req]
  (let [id (get-in req [:params :id])
        data (:body req)
        todo (todo/find-by-id id)]
    (if todo
      (do
        (todo/update id data)
        {:status 200
         :body {:todo (todo/find-by-id id)}})
      {:status 404
       :body {:error "Not found"}})))

(defn delete-todo [req]
  (let [id (get-in req [:params :id])]
    (todo/delete id)
    {:status 204 :body nil}))

; 앱
[APP todo-app
 :port 3000
 :database {:url "sqlite:todo.db"}
 :routes [
  [GET "/todos" list-todos]
  [POST "/todos" create-todo]
  [PUT "/todos/:id" update-todo]
  [DELETE "/todos/:id" delete-todo]
 ]]
```

## 실행

```bash
v9 todo-app.fl
# → 서버가 포트 3000에서 시작됨
```

## API 테스트

```bash
# TODO 목록 조회
curl http://localhost:3000/todos

# TODO 생성
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn FreeLang"}'

# TODO 업데이트
curl -X PUT http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# TODO 삭제
curl -X DELETE http://localhost:3000/todos/1
```

---

[다른 예제로 돌아가기](../examples/)
