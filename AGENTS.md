# 롱보더 키우기 패치 반영

사용자가 요청한 패치는 관련 테스트와 빌드를 확인한 후 해당 변경만 커밋하고, `hyeons153/board`의 `main`에 푸시한다. Vercel `seohs/board`는 `main`을 운영 배포 브랜치로 사용한다. 마지막으로 해당 커밋의 배포가 완료되고 [운영 게임](https://board-sigma-indol.vercel.app)에 연결되었는지 확인한다. 사용자가 별도로 배포 범위를 지정하면 그 요청을 따른다.
