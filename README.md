# 자유방임 마을

브라우저에서 돌아가는 마을 시뮬레이션.

- `index.html` — 실행 파일 (엔진+화면 합본, 브라우저로 바로 열면 됨)
- `engine.js` — 시뮬레이션 엔진 (`createWorld(seed, N)`)
- `ui2.html` — 화면 코드 (`/*ENGINE*/` 자리에 engine.js가 들어감)

빌드:
```
python3 -c "s=open('ui2.html').read();e=open('engine.js').read();open('index.html','w').write(s.replace('/*ENGINE*/',e))"
```
