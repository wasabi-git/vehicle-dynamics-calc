# MODELS.generated.md

> Auto-generated from `data/models.v0.1.json`. Machine tokens are authoritative; display names are maintained here through the model registry.

## Model groups

| model_group | display_name | description |
| --- | --- | --- |
| tire_and_wheel_geometry | Tire and Wheel Geometry | Models for tire-size and wheel-geometry relations. |
| powertrain_kinematics | Powertrain Kinematics | Kinematic relations between engine speed, wheel speed, gearing, and vehicle speed. |
| acceleration_performance | Acceleration Performance | Models related to longitudinal vehicle acceleration performance. |

## Models

| model_name | display_name | model_group | description |
| --- | --- | --- | --- |
| tire_size_radius_model | Tire size radius model | tire_and_wheel_geometry | Nominal wheel-and-tire radius calculated from tire section width, aspect ratio, and rim diameter. |
| powertrain_speed_relation | Powertrain speed relation | powertrain_kinematics | No-slip kinematic relation between engine speed, wheel radius, total gearing, and vehicle speed. |
| engine_power_calculation | Engine power calculation | acceleration_performance | Engine power calculated from torque and engine speed at a common operating point. |
| engine_tractive_force_at_wheels | Engine tractive force at wheels | acceleration_performance | Wheel tractive force calculated from engine torque, gearing, drivetrain efficiency, and wheel radius. |
| mass_factor_approximation | Mass factor approximation | acceleration_performance | Empirical mass-factor approximation based on combined gear ratio. |
| weight_to_mass_relation | Weight-to-mass relation | acceleration_performance | Fundamental relation converting vehicle weight force to vehicle mass. |
| engine_limited_acceleration | Engine-limited acceleration | acceleration_performance | Longitudinal acceleration calculated from engine-generated tractive force, road-load terms, mass, and mass factor. |
| ideal_constant_power_acceleration | Ideal constant-power acceleration | acceleration_performance | Idealized acceleration calculated from constant engine power, vehicle speed, and vehicle mass. |

## Recommendation

- `engine_limited_acceleration` is the recommended model for `longitudinal_acceleration` when F007 is available.
- `ideal_constant_power_acceleration` is retained as a different-model comparison and requires explicit user selection when the recommended model is unavailable.
