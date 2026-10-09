use crate::math::{RawRotation, RawVector};
use rapier::dynamics::{
    FixedJointBuilder, GenericJoint, JointAxesMask, JointAxis, MotorModel, PrismaticJointBuilder,
    RevoluteJointBuilder, RopeJointBuilder, SpringJointBuilder,
};
#[cfg(feature = "dim3")]
use rapier::dynamics::{GenericJointBuilder, SphericalJointBuilder};
use rapier::math::Pose;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[cfg(feature = "dim2")]
pub enum RawJointType {
    Revolute,
    Fixed,
    Prismatic,
    Rope,
    Spring,
    Generic,
}

#[wasm_bindgen]
#[cfg(feature = "dim3")]
pub enum RawJointType {
    Revolute,
    Fixed,
    Prismatic,
    Rope,
    Spring,
    Spherical,
    Generic,
}

/// The type of this joint.
#[cfg(feature = "dim2")]
impl From<JointAxesMask> for RawJointType {
    fn from(ty: JointAxesMask) -> RawJointType {
        let rev_axes = JointAxesMask::LIN_X | JointAxesMask::LIN_Y;
        let pri_axes = JointAxesMask::LIN_Y | JointAxesMask::ANG_X;
        let fix_axes = JointAxesMask::LIN_X | JointAxesMask::LIN_Y | JointAxesMask::ANG_X;

        if ty == rev_axes {
            RawJointType::Revolute
        } else if ty == pri_axes {
            RawJointType::Prismatic
        } else if ty == fix_axes {
            RawJointType::Fixed
        } else {
            RawJointType::Generic
        }
    }
}

/// The type of this joint.
#[cfg(feature = "dim3")]
impl From<JointAxesMask> for RawJointType {
    fn from(ty: JointAxesMask) -> RawJointType {
        let rev_axes = JointAxesMask::LIN_X
            | JointAxesMask::LIN_Y
            | JointAxesMask::LIN_Z
            | JointAxesMask::ANG_Y
            | JointAxesMask::ANG_Z;
        let pri_axes = JointAxesMask::LIN_Y
            | JointAxesMask::LIN_Z
            | JointAxesMask::ANG_X
            | JointAxesMask::ANG_Y
            | JointAxesMask::ANG_Z;
        let sph_axes = JointAxesMask::LOCKED_SPHERICAL_AXES;
        let fix_axes = JointAxesMask::LIN_X
            | JointAxesMask::LIN_Y
            | JointAxesMask::LIN_Z
            | JointAxesMask::ANG_X
            | JointAxesMask::ANG_Y
            | JointAxesMask::ANG_Z;

        if ty == rev_axes {
            RawJointType::Revolute
        } else if ty == pri_axes {
            RawJointType::Prismatic
        } else if ty == sph_axes {
            RawJointType::Spherical
        } else if ty == fix_axes {
            RawJointType::Fixed
        } else {
            RawJointType::Generic
        }
    }
}

#[wasm_bindgen]
pub enum RawMotorModel {
    AccelerationBased,
    ForceBased,
}

impl From<RawMotorModel> for MotorModel {
    fn from(model: RawMotorModel) -> MotorModel {
        match model {
            RawMotorModel::AccelerationBased => MotorModel::AccelerationBased,
            RawMotorModel::ForceBased => MotorModel::ForceBased,
        }
    }
}

#[cfg(feature = "dim2")]
#[wasm_bindgen]
#[derive(Copy, Clone)]
pub enum RawJointAxis {
    LinX,
    LinY,
    AngX,
}

#[cfg(feature = "dim3")]
#[wasm_bindgen]
#[derive(Copy, Clone)]
pub enum RawJointAxis {
    LinX,
    LinY,
    LinZ,
    AngX,
    AngY,
    AngZ,
}

impl From<RawJointAxis> for JointAxis {
    fn from(axis: RawJointAxis) -> JointAxis {
        match axis {
            RawJointAxis::LinX => JointAxis::LinX,
            RawJointAxis::LinY => JointAxis::LinY,
            #[cfg(feature = "dim3")]
            RawJointAxis::LinZ => JointAxis::LinZ,
            RawJointAxis::AngX => JointAxis::AngX,
            #[cfg(feature = "dim3")]
            RawJointAxis::AngY => JointAxis::AngY,
            #[cfg(feature = "dim3")]
            RawJointAxis::AngZ => JointAxis::AngZ,
        }
    }
}

#[wasm_bindgen]
pub struct RawGenericJoint(pub(crate) GenericJoint);

#[wasm_bindgen]
impl RawGenericJoint {
    /// Creates a new joint descriptor that builds generic joints.
    ///
    /// Generic joints allow arbitrary axes of freedom to be selected
    /// for the joint from the available 6 degrees of freedom.
    #[cfg(feature = "dim3")]
    pub fn generic(
        anchor1: &RawVector,
        anchor2: &RawVector,
        axis: &RawVector,
        lockedAxes: u8,
    ) -> Option<RawGenericJoint> {
        let axesMask: JointAxesMask = JointAxesMask::from_bits(lockedAxes)?;
        let axis = axis.0.try_normalize()?;
        let joint: GenericJoint = GenericJointBuilder::new(axesMask)
            .local_anchor1(anchor1.0.into())
            .local_anchor2(anchor2.0.into())
            .local_axis1(axis)
            .local_axis2(axis)
            .into();
        Some(Self(joint))
    }

    pub fn spring(
        rest_length: f32,
        stiffness: f32,
        damping: f32,
        anchor1: &RawVector,
        anchor2: &RawVector,
    ) -> Self {
        Self(
            SpringJointBuilder::new(rest_length, stiffness, damping)
                .local_anchor1(anchor1.0.into())
                .local_anchor2(anchor2.0.into())
                .into(),
        )
    }

    pub fn rope(length: f32, anchor1: &RawVector, anchor2: &RawVector) -> Self {
        Self(
            RopeJointBuilder::new(length)
                .local_anchor1(anchor1.0.into())
                .local_anchor2(anchor2.0.into())
                .into(),
        )
    }

    /// Create a new joint descriptor that builds spherical joints.
    ///
    /// A spherical joints allows three relative rotational degrees of freedom
    /// by preventing any relative translation between the anchors of the
    /// two attached rigid-bodies.
    #[cfg(feature = "dim3")]
    pub fn spherical(anchor1: &RawVector, anchor2: &RawVector) -> Self {
        Self(
            SphericalJointBuilder::new()
                .local_anchor1(anchor1.0.into())
                .local_anchor2(anchor2.0.into())
                .into(),
        )
    }

    /// Creates a new joint descriptor that builds a Prismatic joint.
    ///
    /// A prismatic joint removes all the degrees of freedom between the
    /// affected bodies, except for the translation along one axis.
    ///
    /// Returns `None` if any of the provided axes cannot be normalized.
    #[cfg(feature = "dim2")]
    pub fn prismatic(
        anchor1: &RawVector,
        anchor2: &RawVector,
        axis: &RawVector,
        limitsEnabled: bool,
        limitsMin: f32,
        limitsMax: f32,
    ) -> Option<RawGenericJoint> {
        let axis = axis.0.try_normalize()?;
        let mut joint = PrismaticJointBuilder::new(axis)
            .local_anchor1(anchor1.0.into())
            .local_anchor2(anchor2.0.into());

        if limitsEnabled {
            joint = joint.limits([limitsMin, limitsMax]);
        }

        Some(Self(joint.into()))
    }

    /// Creates a new joint descriptor that builds a Prismatic joint.
    ///
    /// A prismatic joint removes all the degrees of freedom between the
    /// affected bodies, except for the translation along one axis.
    ///
    /// Returns `None` if any of the provided axes cannot be normalized.
    #[cfg(feature = "dim3")]
    pub fn prismatic(
        anchor1: &RawVector,
        anchor2: &RawVector,
        axis: &RawVector,
        limitsEnabled: bool,
        limitsMin: f32,
        limitsMax: f32,
    ) -> Option<RawGenericJoint> {
        let axis = axis.0.try_normalize()?;
        let mut joint = PrismaticJointBuilder::new(axis)
            .local_anchor1(anchor1.0.into())
            .local_anchor2(anchor2.0.into());

        if limitsEnabled {
            joint = joint.limits([limitsMin, limitsMax]);
        }

        Some(Self(joint.into()))
    }

    /// Creates a new joint descriptor that builds a Fixed joint.
    ///
    /// A fixed joint removes all the degrees of freedom between the affected bodies.
    pub fn fixed(
        anchor1: &RawVector,
        axes1: &RawRotation,
        anchor2: &RawVector,
        axes2: &RawRotation,
    ) -> RawGenericJoint {
        let pos1 = Pose::from_parts(anchor1.0, axes1.0);
        let pos2 = Pose::from_parts(anchor2.0, axes2.0);
        Self(
            FixedJointBuilder::new()
                .local_frame1(pos1)
                .local_frame2(pos2)
                .into(),
        )
    }

    /// Create a new joint descriptor that builds Revolute joints.
    ///
    /// A revolute joint removes all degrees of freedom between the affected
    /// bodies except for the rotation.
    #[cfg(feature = "dim2")]
    pub fn revolute(
        anchor1: &RawVector,
        anchor2: &RawVector,
        limitsEnabled: bool,
        limitsMin: f32,
        limitsMax: f32,
    ) -> Option<RawGenericJoint> {
        let mut joint = RevoluteJointBuilder::new()
            .local_anchor1(anchor1.0.into())
            .local_anchor2(anchor2.0.into());
        if limitsEnabled {
            joint = joint.limits([limitsMin, limitsMax]);
        }
        Some(Self(joint.into()))
    }

    /// Create a new joint descriptor that builds Revolute joints.
    ///
    /// A revolute joint removes all degrees of freedom between the affected
    /// bodies except for the rotation along one axis.
    #[cfg(feature = "dim3")]
    pub fn revolute(
        anchor1: &RawVector,
        anchor2: &RawVector,
        axis: &RawVector,
        limitsEnabled: bool,
        limitsMin: f32,
        limitsMax: f32,
    ) -> Option<RawGenericJoint> {
        let axis = axis.0.try_normalize()?;
        let mut joint = RevoluteJointBuilder::new(axis)
            .local_anchor1(anchor1.0.into())
            .local_anchor2(anchor2.0.into());
        if limitsEnabled {
            joint = joint.limits([limitsMin, limitsMax]);
        }
        Some(Self(joint.into()))
    }

    /// Create a new joint descriptor that builds Revolute joints with
    /// independent local axes for each attached rigid-body.
    ///
    /// This is equivalent to a revolute generic joint with all linear axes
    /// locked and only angular X free, but it preserves the local hinge axis
    /// on each body instead of assuming they are identical.
    #[cfg(feature = "dim3")]
    pub fn revoluteWithAxes(
        anchor1: &RawVector,
        anchor2: &RawVector,
        axis1: &RawVector,
        axis2: &RawVector,
        limitsEnabled: bool,
        limitsMin: f32,
        limitsMax: f32,
    ) -> Option<RawGenericJoint> {
        let axis1 = axis1.0.try_normalize()?;
        let axis2 = axis2.0.try_normalize()?;
        let mut joint: GenericJoint = GenericJointBuilder::new(JointAxesMask::LOCKED_REVOLUTE_AXES)
            .local_anchor1(anchor1.0.into())
            .local_anchor2(anchor2.0.into())
            .local_axis1(axis1)
            .local_axis2(axis2)
            .into();
        if limitsEnabled {
            joint.set_limits(JointAxis::AngX, [limitsMin, limitsMax]);
        }
        Some(Self(joint))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rapier::math::Vector;

    #[cfg(feature = "dim3")]
    #[test]
    fn spherical_joint_type_uses_locked_linear_axes() {
        let anchor = RawVector(Vector::ZERO);
        let joint = RawGenericJoint::spherical(&anchor, &anchor);
        assert_eq!(joint.0.locked_axes, JointAxesMask::LOCKED_SPHERICAL_AXES);
        assert!(matches!(joint.0.locked_axes.into(), RawJointType::Spherical));
        // Locking rotations leaves translations free; it is not a spherical joint.
        let angular = JointAxesMask::ANG_X | JointAxesMask::ANG_Y | JointAxesMask::ANG_Z;
        assert!(matches!(angular.into(), RawJointType::Generic));

        let mut bodies = rapier::dynamics::RigidBodySet::new();
        let parent = bodies.insert(rapier::dynamics::RigidBodyBuilder::fixed());
        let child = bodies.insert(rapier::dynamics::RigidBodyBuilder::dynamic());
        let mut joints = crate::dynamics::RawImpulseJointSet::new();
        let handle = joints.createJoint(
            &joint,
            crate::utils::flat_handle(parent.0),
            crate::utils::flat_handle(child.0),
            true,
        );
        assert!(matches!(joints.jointType(handle), RawJointType::Spherical));
    }

    #[test]
    fn revolute_creation_respects_enabled_and_disabled_limits() {
        let anchor = RawVector(Vector::ZERO);
        for enabled in [false, true] {
            #[cfg(feature = "dim2")]
            let joint = RawGenericJoint::revolute(&anchor, &anchor, enabled, -0.4, 0.7).unwrap();
            #[cfg(feature = "dim3")]
            let joint = RawGenericJoint::revolute(
                &anchor,
                &anchor,
                &RawVector(Vector::X),
                enabled,
                -0.4,
                0.7,
            )
            .unwrap();
            let limits = joint.0.limits(JointAxis::AngX);
            assert_eq!(limits.is_some(), enabled);
            if let Some(limits) = limits {
                assert_eq!([limits.min, limits.max], [-0.4, 0.7]);
            }
        }
    }

    #[cfg(feature = "dim3")]
    #[test]
    fn independent_revolute_axes_survive_creation_with_limits() {
        let anchor1 = RawVector(Vector::new(1.0, 2.0, 3.0));
        let anchor2 = RawVector(Vector::new(3.0, 2.0, 1.0));
        for enabled in [false, true] {
            let joint = RawGenericJoint::revoluteWithAxes(
                &anchor1,
                &anchor2,
                &RawVector(Vector::X * 2.0),
                &RawVector(Vector::Y * 3.0),
                enabled,
                -0.4,
                0.7,
            )
            .unwrap();
            // Use rotation for a direction: upstream local_axis getters also translate by the anchor.
            assert!((joint.0.local_frame1.rotation * Vector::X - Vector::X).length() < 1.0e-5);
            assert!((joint.0.local_frame2.rotation * Vector::X - Vector::Y).length() < 1.0e-5);
            assert_eq!(joint.0.limits(JointAxis::AngX).is_some(), enabled);
            assert_eq!(joint.0.local_anchor1(), anchor1.0);
            assert_eq!(joint.0.local_anchor2(), anchor2.0);
            if let Some(limits) = joint.0.limits(JointAxis::AngX) {
                assert_eq!([limits.min, limits.max], [-0.4, 0.7]);
            }
        }
    }
}
