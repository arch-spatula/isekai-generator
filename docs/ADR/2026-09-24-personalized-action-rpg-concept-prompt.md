# ADR: 개인화 이세계 Action RPG 생성 프롬프트 설계

* **Status:** Accepted
* **Date:** 2026-09-24
* **Decision Owners:** Project Owner
* **Scope:** 사주팔자·자미두수·네이탈 차트를 Seed로 사용하는 개인화 이세계 Action RPG 생성 시스템
* **Related Artifact:** [개인화 이세계 Action RPG 생성 Master Prompt](../prompts/personalized-action-rpg-concept.md)

---

# 1. Context

본 프로젝트의 핵심 아이디어는 사용자의

* 생년월일
* 출생시간
* 출생도시

로부터 계산한

* 사주팔자
* 자미두수
* 서양 점성술 네이탈 차트

를 **창작적 Seed**로 사용하여 각 사용자에게 서로 다른 판타지 이세계 Action RPG 경험을 생성하는 것이다.

목표는 운세를 게임 형태로 보여주는 것이 아니다.

핵심 질문은 다음과 같다.

> **"이 사람이 판타지 이세계에 태어났다면 어떤 존재로 태어나, 어떤 삶을 살고, 어떤 방식으로 싸우며, 모험을 통해 무엇이 되어갈 것인가?"**

따라서 점성 체계는 미래를 예측하기 위한 시스템이 아니라 캐릭터와 게임 경험의 생성공간을 결정하는 입력값으로 취급한다.

프로젝트를 구체화하면서 단순한 캐릭터 생성 프롬프트로는 충분하지 않다는 문제가 발견되었다.

프롬프트는 점차 다음 영역을 함께 생성해야 했다.

* Character
* Life
* World
* Combat
* Build
* Exploration
* Relationship
* Progression
* Narrative
* Ending

이 과정에서 여러 형태의 생성 편향과 구조적 문제가 반복적으로 발견되었다.

---

# 2. Decision Drivers

다음 조건을 주요 설계 기준으로 삼았다.

## 2.1 Personalization

다른 사용자가 서로 다른 외형과 이름만 받는 수준을 넘어서야 한다.

가능하면 다음까지 달라져야 한다.

* Race
* Birth
* Family
* Social Position
* Personality
* Occupation
* Life Goal
* Combat Style
* Power Mechanism
* Growth Recipe
* Relationships
* Adventure
* Character Arc
* Potential Ending

즉,

> **Content Personalization뿐 아니라 일부 Gameplay Architecture까지 개인화한다.**

---

## 2.2 Coherence

다양성을 위해 무작위 요소를 조합해서는 안 된다.

결과는 가능한 한 다음과 같은 인과관계를 가져야 한다.

> Astrological Seed
> → Personality / Desire / Contradiction
> → Birth / Life
> → Core Fantasy
> → Gameplay
> → Growth
> → Adventure
> → Identity Evolution

독특함은 설정의 개수가 아니라 **서로 연결된 요소들의 조합**에서 발생해야 한다.

---

## 2.3 Playability

결과는 설정집이 아니라 Action RPG여야 한다.

따라서

> **"이 캐릭터를 실제로 조작하면 무엇이 재미있는가?"**

에 답할 수 있어야 한다.

캐릭터의 상징성과 서사성이 Combat Gameplay를 대체해서는 안 된다.

---

## 2.4 Life Immersion

캐릭터가 강한 전투 콘셉트를 가지고 있는 것만으로는 이세계에 살아간다는 몰입감이 충분하지 않았다.

따라서

> **"이 사람은 싸우지 않을 때 어떻게 살아가는가?"**

역시 핵심 설계질문으로 포함한다.

---

## 2.5 Earned Progression

최종적으로 강력하거나 신화적인 캐릭터가 되는 것은 허용한다.

그러나 가능한 경우 그 정체성은 처음부터 Lore로 지급되는 것이 아니라 플레이를 통해 획득되어야 한다.

> **Mythology should be earned through play.**

---

## 2.6 Implementation Feasibility

사용자마다 완전히 다른 게임 엔진을 생성하는 것은 현실적인 제작전략이 아니다.

따라서 표현되는 Gameplay는 크게 달라질 수 있지만 내부적으로는 재사용 가능한 Gameplay Primitive와 시스템 조합으로 구현할 수 있어야 한다.

---

# 3. Problem 1 — Archetype Collapse

초기 생성에서는 AI가 특정한 판타지 캐릭터 Archetype으로 반복적으로 수렴하는 문제가 있었다.

예:

* 인간
* 몰락귀족
* 신흥 상인·장인 가정
* 검사 또는 마검사
* 분석적인 성격
* 검은 옷
* 긴 코트
* 까마귀·늑대 계열 Familiar
* 고대의 힘
* 저주
* 비밀조직

각 요소가 개별적으로 잘못된 것은 아니다.

문제는 서로 다른 사용자의 입력에도 불구하고 **비슷한 조합이 반복된다는 것**이었다.

---

# 4. Decision 1 — Distinctiveness over Rarity

캐릭터의 목표를 Rarity가 아니라 **Distinctiveness**로 정의한다.

> Rare ≠ Interesting
> Ordinary ≠ Grounded

인간을 선택해도 되고 희귀 종족을 선택해도 된다.

중요한 것은 해당 선택이

* Astrological Seed
* Life
* Gameplay
* Growth

를 가장 자연스럽게 연결하는가이다.

Race, Family, Class, Power Mechanism 등 주요 선택에서는 첫 번째로 떠오른 답을 바로 채택하지 않고 구조적으로 다른 후보를 비교한다.

---

# 5. Problem 2 — Anti-Cliché가 Novelty Slop으로 반전됨

Archetype Collapse를 피하기 위해 다양성을 지나치게 강조하면 반대 문제가 발생할 수 있다.

캐릭터가 다음처럼 설계될 위험이 있다.

> 희귀 종족
>
> * 특이한 머리
> * 얼굴문양
> * 비대칭 의상
> * 여러 문화권 복식
> * 기계장치
> * 동물 모티프
> * 여러 색상
> * 초월적 혈통
> * 저주

결과적으로 차별화는 되었지만 하나의 캐릭터로 읽히지 않는다.

이는 의도적인 디자인보다 **여러 독특한 요소를 위원회식으로 합친 디자인**에 가까워진다.

---

# 6. Decision 2 — Familiarity Penalty + Novelty Penalty

두 종류의 실패를 동시에 방지한다.

### Familiarity Penalty

너무 익숙한 조합으로 수렴하는 것을 억제한다.

### Novelty Penalty

차별화를 위해 서로 무관한 요소를 과도하게 추가하는 것을 억제한다.

캐릭터 디자인은 다음 계층을 사용한다.

### Primary Read

실루엣을 결정하는 1~2개의 핵심 요소.

### Secondary Read

직업·문화·생활·전투방식을 설명하는 요소.

### Tertiary Detail

가까이서 볼 때 발견되는 세부요소.

최종적으로 캐릭터를 한 문장으로 설명하기 어려우면 설정을 줄인다.

---

# 7. Problem 3 — Lore Inflation과 반대 방향의 평균회귀

초기에는 캐릭터를 특별하게 만들기 위해

* 특별한 혈통
* 특별한 무기
* Familiar
* 신의 축복
* 저주
* 비밀조직
* 세계적 운명

등이 동시에 붙는 문제가 있었다.

이를 억제하기 위해 특별함을 제한하자 반대로

* 인간
* 평범한 가정
* 전문직
* 특별한 존재 없음
* Familiar 없음
* 초월적 관계 없음

등으로 반복적으로 회귀할 위험이 생겼다.

---

# 8. Decision 3 — Starting Lore Budget와 Earned Mythology 분리

특별함 자체를 제한하지 않는다.

대신 **시작 시점의 Lore Complexity**와 **게임 전체에서 획득 가능한 특별함**을 구분한다.

초기에는 일반적으로 소수의 Core Extraordinary Element를 사용하고, 다른 특별함은 가능한 경우 그것에서 인과적으로 파생시킨다.

예:

> 특이한 마력기관
> → 마력흡수
> → 이를 제어하는 전투기술
> → 전용 장비
> → 독자적 클래스

후반에는 모험을 통해 훨씬 강력하고 신화적인 요소를 획득할 수 있다.

따라서 최종 원칙은 다음과 같다.

> **강력한 판타지를 제한하지 않는다.
> 완성된 판타지를 시작부터 지급하는 것을 경계한다.**

---

# 9. Problem 4 — 환경조작과 퍼즐로의 과도한 수렴

초기 Gameplay 설계에서 다음과 같은 원칙을 사용했다.

> Action
> → Information
> → Manipulation
> → New Action

또한 Combat / Traversal / Environment의 연결을 강하게 요구했다.

그 결과 분석적이거나 통제적인 캐릭터가 반복적으로

> 구조를 분석한다
> → 지형을 조작한다
> → 전장을 재구성한다
> → 거대 적의 약점을 찾는다
> → 몸 내부에 들어간다
> → Core를 파괴한다

는 패턴으로 수렴했다.

Boss Encounter도 Action Combat보다 환경 Puzzle처럼 느껴지기 시작했다.

---

# 10. Decision 4 — Action Combat First

기본 장르 정체성을 Action RPG로 명확하게 한다.

환경과 Puzzle은 Gameplay를 풍부하게 하는 보조축으로 사용한다.

대략적인 지향은 다음과 같다.

* Combat / Action: 55~70%
* Exploration: 15~25%
* Puzzle / Environmental Interaction: 5~15%
* Dialogue / Narrative Interaction: 5~15%

정확한 비율로 강제하지는 않는다.

가장 중요한 테스트는 다음이다.

> **"아무것도 없는 평평한 전투공간에서 적 10마리와 싸워도 이 캐릭터가 재미있는가?"**

환경을 제거했을 때 Gameplay가 붕괴한다면, 환경조작 자체가 명시적인 Core Fantasy인 경우를 제외하고 Combat Design을 재검토한다.

---

# 11. Decision 5 — Boss는 Puzzle이 아니라 Build Test

Boss를 특정한 하나의 공략법으로 해결하는 Puzzle로 만들지 않는다.

다음과 같은 다양한 Encounter를 사용할 수 있다.

* Duel
* Beast
* Caster
* Hunter
* Horde
* Swarm
* Giant
* Rival
* Transformation
* Siege
* Pursuit
* Survival
* Multi-party
* Puzzle Hybrid

Boss의 주요 역할은

> **현재 Character Fantasy와 Build를 강하게 시험하는 것**

이다.

Puzzle Hybrid는 Boss 유형 중 하나일 뿐이다.

---

# 12. Problem 5 — Skill Unlock 기반 성장

초기 Progression은 새로운 지역이나 Chapter마다 새로운 Action Verb를 획득하는 방향으로 설계되었다.

이는 자연스럽게

> 새 Skill
> → 새 Button
> → 새 Terrain Gate
> → 새 Puzzle

구조로 연결되었다.

결과적으로 캐릭터가 성장한다기보다 버튼이 하나씩 추가되는 느낌이 강해졌다.

---

# 13. Decision 6 — Full Kit First + Synergy Growth

캐릭터의 기본 Combat Grammar는 초반부터 상당 부분 사용할 수 있도록 한다.

예:

* Basic Attack
* Heavy / Alternate Attack
* Dodge
* Defense
* Core Mechanic
* Mobility
* Resource

성장의 중심은 새로운 버튼이 아니라 **기존 행동의 의미 변화**다.

예:

> Perfect Guard
> → 공격 봉인
> → 봉인 에너지 저장
> → Familiar 충전
> → 무기 속성 변화
> → Curse Gauge 증가
> → Finisher 조건 충족

따라서 성장의 핵심은 다음과 같다.

> **More Buttons보다 More Interaction.**

---

# 14. Decision 7 — Vertical / Horizontal / Architectural Growth

성장을 세 종류로 구분한다.

### Vertical Growth

기존 행동의 위력·효율·규모가 증가한다.

### Horizontal Growth

같은 능력의 사용방법과 다른 시스템과의 상호작용이 증가한다.

### Architectural Growth

Gameplay Architecture 자체가 변화한다.

예:

> Familiar
> → Familiar Mount
> → Mounted Combat
> → Transformation
> → Fusion

Architectural Growth는 강력한 변화이므로 모든 캐릭터에게 요구하지 않는다.

검 하나를 끝까지 깊게 발전시키는 캐릭터도 유효하다.

---

# 15. Problem 6 — 캐릭터가 살아가는 느낌의 부족

Character Fantasy, Combat, Build, Adventure를 상세하게 설계해도 결과가 여전히

> 캐릭터 생성
> → Quest
> → 전투
> → 성장
> → Boss

라는 게임 구조처럼 느껴질 수 있었다.

캐릭터가 **이세계에서 실제 인생을 살고 있다**는 감각이 부족했다.

---

# 16. Decision 8 — Life Fantasy

다음 질문을 독립적인 설계축으로 추가한다.

> **"이 사람은 모험하지 않을 때 어떻게 살아가는가?"**

다음을 필요에 따라 생성한다.

* Home
* Family
* Occupation
* Livelihood
* Daily Routine
* Personal Goal
* Friends
* Important Objects
* Life Milestones

Character Fantasy와 Gameplay Fantasy 사이에 **Life Fantasy**를 둔다.

---

# 17. Decision 9 — Life Anchor

캐릭터에게 약 3~5개의 Life Anchor를 부여한다.

종류:

* Person
* Place
* Object
* Routine
* Goal

이들은 설정집의 배경정보로 끝나지 않는다.

게임 진행 중 반복해서 등장하고 변화한다.

예:

> 어린 시절 친구
> → 오랜 여행
> → 재회
> → 서로 다른 세력에 속함.

또는:

> 작업용 골렘
> → 어린 시절 추억
> → 직접 수리
> → 모험용 개조
> → Combat Mech
> → Signature Machine.

---

# 18. Decision 10 — Adventure → Return

게임이 계속 새로운 지역만 소비하면 장소에 대한 애착이 형성되기 어렵다.

따라서 중요한 모험 뒤에는 가능한 경우 **Return**을 사용한다.

> Adventure
> → Return
> → Consequence
> → Changed Life
> → Next Adventure

귀환했을 때

* Home
* NPC
* Family
* Occupation
* Economy
* Reputation
* Relationships
* Player Character

중 일부가 변화한다.

핵심 원칙:

> **Adventure는 세계를 발견하게 한다.
> Return은 그 세계에 속해 있음을 느끼게 한다.**

---

# 19. Decision 11 — Passage of Time

Level Progression만으로 인생의 진행을 표현하지 않는다.

필요한 경우 시간이 다음에 흔적을 남긴다.

* Age
* Appearance
* Family
* Friends
* NPC Career
* Home
* City
* Social Position
* Equipment
* Relationships

Progression을

> Lv.1 → Lv.30

뿐 아니라

> 어린 시절
> → 견습
> → 독립
> → 모험가
> → 전문가
> → 누군가에게 의지되는 사람

으로도 경험할 수 있게 한다.

---

# 20. Decision 12 — Personal Stakes before World Stakes

세계적 위기를 기본적인 Inciting Incident로 사용하지 않는다.

초기에는 개인적인 목표를 허용한다.

예:

* 돈을 번다.
* 가족을 돕는다.
* 친구를 찾는다.
* 집을 얻는다.
* 병을 치료한다.
* 기술을 배운다.
* 공방을 만든다.

필요한 경우 이것이 다음처럼 확대된다.

> Personal
> → Local
> → Regional
> → Political
> → Mythic

플레이어가 세계를 구해야 하기 때문에 사건에 관심을 가지는 것이 아니라,

> **이미 관심을 가지고 있던 삶의 문제가 더 큰 세계와 연결되었기 때문에**

관여하게 만드는 것을 선호한다.

---

# 21. Problem 7 — Weapon + Familiar 중심의 Gameplay Model

Gameplay를 구체화하면서 암묵적으로 다음 구조가 형성되었다.

> Character
>
> * Weapon
> * Familiar
> * Blessing / Curse
> * Equipment

이는 많은 캐릭터에는 적합하지만 모든 Character Fantasy를 포괄하지 못한다.

예를 들어 다음과 같은 캐릭터는 다른 구조가 필요하다.

* 여러 Familiar를 동시에 지휘하는 조련사
* 마수에 탑승해 싸우는 기병
* 거대한 Mech를 직접 조종하는 기술자
* 여러 Construct를 사용하는 인형사
* 자신의 몸 자체가 무기인 격투가
* 다른 생물로 변신하는 전사
* 영혼에 빙의하는 영매
* 병력을 지휘하는 Commander

---

# 22. Decision 13 — Power Expression Architecture

`Weapon`을 상위 개념으로 사용하지 않는다.

먼저 다음 질문을 한다.

> **"이 캐릭터는 무엇을 통해 자신의 힘을 세계에 행사하는가?"**

이를 **Power Expression Architecture**라고 정의한다.

가능한 Family에는 다음이 있다.

* Weapon
* Body
* Magic
* Stance / Form
* Transformation
* Single Familiar
* Familiar Pack
* Swarm
* Summoning
* Construct
* Device / Turret / Drone
* Combat Mount
* Vehicle / Mech
* Power Armor
* Possession
* Symbiote
* Avatar
* Clone
* Captured Power
* Artifact
* Command
* Party
* Domain
* Crafting Combat
* Movement
* Risk State
* Original Mechanism

목록은 Exhaustive하지 않다.

새로운 메커니즘을 생성할 수 있다.

---

# 23. Decision 14 — Primary / Secondary / Modifier

Power Expression을 다음 세 계층으로 구성한다.

## Primary Mechanism

캐릭터의 조작감을 결정하는 중심 메커니즘.

일반적으로 1개.

## Secondary Mechanism

Primary를 보완하거나 변형한다.

필요한 경우 0~2개.

## Growth Modifier

모험을 통해 획득하여 기존 시스템을 변화시킨다.

예:

### Sealing Swordsman

Primary: Weapon
Secondary: Captured Power
Modifier: Equipment / Curse

### Beast Rider

Primary: Combat Mount
Secondary: Weapon
Modifier: Mount Evolution / Armor

### Mechanic

Primary: Vehicle / Mech
Secondary: Drone
Modifier: Modules / Overheat

### Beastmaster

Primary: Familiar Pack
Secondary: Command
Modifier: Evolution / Formation

### Spirit Medium

Primary: Possession
Secondary: Spirit Collection
Modifier: Contract

이 구조를 통해 Equipment, Familiar, Blessing, Curse 등을 모든 캐릭터가 동일하게 갖는 고정 슬롯에서 제거한다.

---

# 24. Decision 15 — Power Mechanism은 삶과 연결한다

Power Expression은 점성 상징에서 직접 생성될 필요가 없다.

다음 중 하나 이상의 인과관계를 가질 수 있다.

* Race
* Family
* Childhood
* Culture
* Occupation
* Environment
* Relationship
* Accident
* Training
* Adventure
* Player Choice

예:

> 목축민
> → 어린 시절부터 마수와 생활
> → 이동수단
> → 동료
> → Combat Mount
> → Mounted Combat.

또는:

> 기계공 집안
> → 작업용 골렘
> → 수리
> → 탐사용 개조
> → Combat Mech.

따라서 Gameplay와 Life를 별도의 생성결과로 취급하지 않는다.

---

# 25. Decision 16 — Shared Grammar, Personalized Architecture

개인화 Gameplay가 사용자마다 완전히 새로운 엔진을 의미하지는 않는다.

구현에서는 재사용 가능한 Gameplay Primitive를 조합할 수 있다.

예:

* Melee
* Projectile
* Movement
* Defense
* Resource
* Companion
* Command
* Mount
* Vehicle
* Transform
* Deployable
* Capture
* Status
* Summon
* Interaction

AI는 이러한 Primitive를 조합하고 파라미터화하여 서로 다른 Power Expression을 만든다.

따라서 목표는

> **One Gameplay System per User**

가 아니라

> **Shared Action Grammar + Personalized Gameplay Architecture**

다.

이는 생성 다양성과 구현 가능성 사이의 핵심 절충이다.

---

# 26. Rejected Alternatives

## 26.1 점성 결과를 직접 Class Table에 Mapping

예:

> 특정 오행 → 특정 직업
> 특정 별 → 특정 클래스.

### Rejected because

결정론적이고 생성 다양성이 낮으며 반복적인 결과를 만든다.

---

## 26.2 모든 사용자에게 동일한 Character Template 사용

예:

> Race + Weapon + Familiar + Blessing + Curse.

### Rejected because

표면적인 설정은 달라져도 Gameplay Architecture가 반복된다.

---

## 26.3 완전히 자유로운 생성

프롬프트에 제한을 거의 두지 않고 모델의 창의성에 맡긴다.

### Rejected because

Archetype Collapse, Lore Inflation, Novelty Slop 및 Gameplay 불일치가 발생하기 쉽다.

---

## 26.4 특별함을 강하게 제한

모든 캐릭터를 Grounded하게 유지한다.

### Rejected because

Grounded가 또 하나의 Default Archetype이 되며 판타지적 잠재력을 제한한다.

---

## 26.5 처음부터 완성된 Mythic Character 생성

### Rejected because

플레이어가 성장과 획득의 역사를 경험할 공간이 줄어든다.

---

## 26.6 Ability Unlock 중심 Progression

### Rejected because

성장이 새로운 버튼과 Terrain Key의 연속으로 변하기 쉽다.

---

## 26.7 Environment / Puzzle 중심 Gameplay

### Rejected because

다른 Character Fantasy가 모두 비슷한 문제해결 방식으로 수렴했다.

---

## 26.8 계속 새로운 지역으로 이동하는 Adventure 구조

### Rejected because

장소와 NPC가 일회성 콘텐츠가 되고 세계에 대한 애착이 약해진다.

---

# 27. Consequences

## Positive

### 높은 Character Diversity

캐릭터의 차이가 외형이나 Class Name에 그치지 않는다.

### 높은 Gameplay Diversity

검사, 기병, 소환사, 변신형, 메카 파일럿 등이 동일한 생성시스템에서 나올 수 있다.

### 높은 Life Immersion

Home, Life Anchor, Return, Passage of Time을 통해 세계를 소비하는 것이 아니라 살아가는 감각을 제공할 수 있다.

### Earned Identity

후반의 강력한 정체성이 플레이어가 지나온 Adventure의 결과로 남는다.

### 구현 가능성

Shared Gameplay Primitive를 사용하면 개인화된 Gameplay Architecture를 완전히 별개의 게임으로 구현할 필요가 없다.

---

## Negative

### Generation Complexity 증가

캐릭터뿐 아니라 Life, Gameplay Architecture, Progression, Narrative 사이의 일관성을 유지해야 한다.

### Validation 필요

생성결과가 실제 구현 가능한 Gameplay인지 검증하는 별도의 단계가 필요하다.

### Content Explosion

Power Architecture와 Branching Life를 자유롭게 생성하면 필요한 Asset과 Animation 수가 급격히 증가할 수 있다.

### Balance Complexity

서로 다른 Mechanism을 동일한 Action RPG에서 밸런싱해야 한다.

### Runtime Generation Risk

AI가 새로운 Gameplay Mechanism을 제안하더라도 실제 Engine Primitive로 표현할 수 없는 경우가 발생할 수 있다.

---

# 28. Implementation Implications

향후 시스템에서는 Master Prompt의 자연어 결과를 그대로 게임으로 변환하기보다 중간 표현을 두는 것이 적절하다.

예:

```text
Astrological Seed
        ↓
Character Generation
        ↓
Life Model
        ↓
Power Expression Architecture
        ↓
Gameplay Schema
        ↓
Validation
        ↓
Narrative / Progression Graph
        ↓
Game Generation
```

Gameplay Architecture는 예를 들어 다음처럼 구조화할 수 있다.

```text
PowerArchitecture
├── primary
├── secondary[]
├── resource
├── movement
├── offense
├── defense
├── entities[]
├── modifiers[]
├── progression
└── evolution
```

그리고 각 Mechanism을 Engine Primitive로 변환한다.

예:

```text
Combat Mount
→ movement.mount
→ entity.companion
→ attack.mounted
→ animation.rider
```

```text
Familiar Pack
→ entity.companion[]
→ command
→ target.assignment
→ formation
```

```text
Mech
→ vehicle
→ resource.overheat
→ equipment.module
→ alternate_moveset
```

이 구조는 향후 별도의 ADR에서 구체화한다.

---

# 29. Future Decisions

현재 ADR에서는 다음을 결정하지 않는다.

별도 ADR 후보:

### ADR — World Generation Architecture

공통 World Seed와 사용자별 Character Seed를 어떻게 분리할 것인가.

### ADR — Gameplay Primitive Schema

생성 가능한 Power Expression을 어떤 Engine Primitive로 표현할 것인가.

### ADR — Generated Mechanism Validation

AI가 생성한 Gameplay Architecture가 실제 구현 가능한지 어떻게 검증할 것인가.

### ADR — Character Diversity / Corpus Memory

여러 사용자 사이에서 Archetype Collapse를 어떻게 정량적으로 탐지할 것인가.

### ADR — Progression State Model

Immutable / Mutable / Potential State와 Event Log를 어떻게 저장할 것인가.

### ADR — Narrative Runtime

초기 Master Generation과 Runtime Chapter Generation을 어떻게 분리할 것인가.

### ADR — Asset Generation Strategy

개인화된 Race, Equipment, Familiar, Mount, Mech 등에 필요한 Asset을 어떻게 생성·재사용할 것인가.

---

# 30. Decision Summary

본 프로젝트에서는 점성·명리 정보를 Class나 운명에 직접 Mapping하지 않는다.

대신 이를

> **Personality / Desire / Contradiction을 생성하는 Creative Seed**

로 사용한다.

생성된 캐릭터는

> **Character Fantasy**

뿐 아니라

> **Life Fantasy**

와

> **Gameplay Fantasy**

를 가져야 한다.

Gameplay는 Weapon 중심으로 고정하지 않고 **Power Expression Architecture**를 통해 Weapon, Body, Familiar, Mount, Mech, Transformation, Possession, Command 등 다양한 구조를 허용한다.

성장은

> **새로운 버튼을 지속적으로 획득하는 과정**

보다

> **기존 Gameplay Mechanism 사이의 상호작용과 의미가 깊어지는 과정**

을 우선한다.

세계에 대한 몰입은 끊임없는 Adventure만으로 만들지 않는다.

> **Life Anchor + Adventure + Return + Passage of Time**

을 통해 플레이어가 세계에 실제로 살아왔다는 감각을 만든다.

강력하고 신화적인 판타지는 허용한다.

그러나 가능한 경우

> **Starting Lore가 아니라 플레이의 결과로 획득한다.**

최종적으로 지향하는 구조는 다음과 같다.

```text
Astrological Seed
        ↓
Core Traits / Desire / Contradictions
        ↓
Birth / Race / Family / Culture
        ↓
Life Fantasy
        ↓
Core Character Fantasy
        ↓
Power Expression Architecture
        ↓
Starting Gameplay
        ↓
Personal Stakes
        ↓
Adventure
        ↓
Return / Life Change
        ↓
Build Synergy
        ↓
Mechanism / Identity Evolution
        ↓
Larger Responsibility
        ↓
Earned Mythology
        ↓
Player Choice
        ↓
Life Ending
```

핵심 제품 경험은 다음 한 문장으로 정리한다.

> **"나의 Seed에서 태어난 한 사람이 이세계에서 실제 삶을 시작하고, 자신만의 방식으로 싸우고 살아가며, 모험의 결과를 몸·관계·장비·집·세계에 축적하고, 플레이어의 선택을 통해 자신만의 삶과 신화를 만들어가는 Action RPG."**
