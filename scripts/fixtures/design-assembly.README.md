# Design assembly synthetic cases

These cases contain invented game designs and independently authored machine declarations. They do not read personal charts or prior generated games. `designDraft` removes only tool-managed declarations from final-validator fixtures and inserts the specified production marker; it does not call the assembler.

Automated tests check byte preservation, declarations, source provenance, final validation and SQLite recovery. Passing structure checks does not establish semantic compatibility or design quality.

Manual semantic acceptance case: retain the eleven GDD sections and all valid generated declarations, but describe the core attack as “어깨 너머 카메라를 자유 회전하여 원근 깊이 방향으로 표적을 자유 조준한다.” The existing semantic review must reject this design because its required aiming and camera controls conflict with the fixed top-down plane. The declaration parser and assembler may accept those words; no word classifier should stand in for this review. Conversely, “자유 3D 조준은 사용하지 않는다” is a compatible negative mention and must not be rejected merely for containing those words. This manual case requires a human or existing semantic review and is not an automated semantic-quality claim.
