// 실제 제공 원본만 연결합니다. src는 assets/ 하위 상대 경로입니다.
// 브라우저에서 업로드한 파일이 있으면 해당 기기의 파일이 우선합니다.
window.PhuketMedia = {
  'opening-video': {src:'assets/opening-group-v2.mp4', poster:'assets/opening-group-v2-poster.jpg', label:'푸켓 오프닝 · 실제 여행 기록 · Holiday Fun · 81.4초'},
  'sea-photo': {src:'assets/sea.jpg', label:'실제 푸켓 해변 사진 · 네 사람 모두 함께', gallery:[
    {src:'assets/pool.jpg',label:'실제 여행 기록 · 수영장과 푸켓 풍경'},
    {src:'assets/jetski-drone.jpg',label:'실제 드론 원본 · 제트스키 질주'}
  ]},
  'taste-photo': {src:'assets/taste.jpg', label:'실제 여행 영상 · 파인애플 볶음밥', gallery:[
    {src:'assets/seafood.jpg',label:'실제 여행 사진 · 함께한 식사와 해산물'},
    {src:'assets/market.jpg',label:'실제 여행 기록 · 과일 가게에서의 자유시간'}
  ]},
  'people-photo': {src:'assets/formal-group.jpg', label:'사용자 확인 사진 · 정장을 차려입은 네 사람', gallery:[
    {src:'assets/shuttle-group.jpg',label:'실제 리조트 사진 · 네 사람의 환한 표정'},
    {src:'assets/beach-full-group.jpg',label:'실제 해변 사진 · 네 사람의 전신과 바다'}
  ]},
  'together-photo': {src:'assets/shuttle-group.jpg', label:'실제 리조트 사진 · 네 사람 모두 함께', gallery:[
    {src:'assets/beach-full-group.jpg',label:'실제 해변 사진 · 네 사람의 전신과 바다'},
    {src:'assets/formal-group.jpg',label:'사용자 확인 사진 · 정장을 차려입은 네 사람'}
  ]},
  'ending-video': {src:'assets/ending-group-v2.mp4', poster:'assets/ending-group-v2-poster.jpg', label:'다음 R&R은, 우리 함께 · 실제 리조트 셔틀 단체사진 · Holiday Fun · 12초'}
};
