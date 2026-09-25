# Retarget pipeline

The runtime now has a canonical retarget boundary:

1. Load one unified Bannon GLB.
2. Index bones using normalized names.
3. Validate the critical torso, leg and arm chains.
4. Capture the source rest pose.
5. Retarget real clips against that rest pose.
6. Restore the captured rest pose before evaluation.
7. Diagnose world transforms for mirrored/non-finite skeleton state.
8. Reject invalid results; never compensate with a fighter-specific 180-degree offset.
9. Only then pass the fighter to PS1 rendering or native Schwarzerblitz conversion.

The diagnostic determinant is a guardrail, not a substitute for visual/pose QA: skeletal transforms can be locally valid while an animation is semantically wrong. Therefore promotion still requires measured bind-pose and motion checks.
