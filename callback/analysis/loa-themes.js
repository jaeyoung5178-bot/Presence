// Phrase matches describe what a LOA review mentions, not why an outcome occurred.
// Keep patterns stateless: reviewAnalysis tests each pattern against many entries.
export const LOA_THEMES = [
  {
    label: '과정 목표와 기회량',
    pattern: /과정\s*목표|목표(?:한)?\s*(?:넘버\s*)?(?:초과\s*)?달성|목표\s*넘버|(?:contact|컨택|컨텍|close|클로즈)\s*목표|(?:contact|컨택|컨텍)\s*(?:넘버|횟수)|(?:넘버|기회량|기회수)\s*(?:가\s*)?(?:쌓|확보|부족|드랍|저조)/i,
    action: '다음 필드에 Contact·Close 중 하나의 과정 목표를 정해 보세요. 미리 정한 점검 시점에 목표와 실제 횟수를 함께 적어요.',
  },
  {
    label: '단계 전환과 유실',
    pattern: /유실|전환율|(?:contact|컨택|컨텍|stop|스탑|presentation|pt|프레젠테이션)\s*(?:to|→|->|에서)\s*(?:stop|스탑|presentation|pt|프레젠테이션|close|클로즈)/i,
    action: '다음 필드에서는 유실이 언급된 구간 하나를 관찰해 보세요. 앞뒤 단계 수와 대화가 멈춘 상황을 한 줄로 남겨요.',
  },
  {
    label: '시간 배분과 공백',
    pattern: /공백|시간\s*(?:당|배분|확보|대비)|(?:필드|휴식|식사)\s*시간|(?:\d{1,2}\s*시|오전|오후)\s*(?:이후|이전|부터|까지)/i,
    action: '다음 필드에서 시작·휴식·이동·마감 시각과 Close 공백이 있었던 구간을 표시해 보세요. 다음 회고에서 확보한 필드 시간을 확인해요.',
  },
  {
    label: '현장 이동과 유동',
    pattern: /테리\s*(?:이동|분석|전략)|사이트\s*(?:이동|성향|운영|선정|변경)|현장\s*(?:이동|선정|변경)|유동|우천\s*대비|(?:우천|이동).{0,12}(?:대비|플랜)/i,
    action: '다음 필드 전에 현장을 다시 살펴볼 시점과 이동 후보 한 곳을 정해 보세요. 그때의 유동과 이동 여부를 기록해요.',
  },
];
