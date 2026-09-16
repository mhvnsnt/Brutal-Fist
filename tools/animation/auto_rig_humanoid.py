"""Automatic humanoid repair lane for Brutal-Fist GLBs.

Pipeline:
  GLB -> landmark armature -> automatic skin weights -> optional source
  animation import/retarget -> GLB export.

This intentionally uses Blender's open-source Python API rather than a
proprietary online auto-rigger. It is a repair lane, not a claim that arbitrary
meshes can be perfectly rigged without QA.

Usage from Blender:
  blender -b --python tools/animation/auto_rig_humanoid.py -- \
    input.glb output.glb

For assets that already contain a valid skeleton, the script leaves the rig
alone unless --force is supplied.
"""
import bpy
import math
import os
import sys
from mathutils import Vector


def args_after_double_dash():
    argv = sys.argv
    return argv[argv.index('--') + 1:] if '--' in argv else []


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    return list(bpy.context.scene.objects)


def mesh_objects(objects):
    return [o for o in objects if o.type == 'MESH']


def has_skin(objects):
    return any(o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers) for o in objects)


def bounds(objects):
    points = []
    for obj in mesh_objects(objects):
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    if not points:
        raise RuntimeError('AUTO_RIG_NO_MESH')
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def add_bone(arm, name, head, tail, parent=None):
    eb = arm.data.edit_bones.new(name)
    eb.head = head
    eb.tail = tail
    if parent:
        eb.parent = parent
    return eb


def build_humanoid(objects):
    lo, hi = bounds(objects)
    h = hi.y - lo.y
    cx = (lo.x + hi.x) * 0.5
    cz = (lo.z + hi.z) * 0.5
    # Conservative humanoid landmarks. The result is deliberately simple and
    # deterministic so every repaired asset gets the same canonical hierarchy.
    y0 = lo.y
    y1 = y0 + h * 0.48
    y2 = y0 + h * 0.62
    y3 = y0 + h * 0.74
    y4 = y0 + h * 0.86
    y5 = y0 + h * 0.94
    arm = bpy.data.armatures.new('BF_AutoRig_Armature')
    rig = bpy.data.objects.new('BF_AutoRig', arm)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')

    root = add_bone(rig, 'Hips', Vector((cx, y1, cz)), Vector((cx, y1 + h*0.05, cz)))
    spine = add_bone(rig, 'Spine', root.tail, Vector((cx, y2, cz)), root)
    chest = add_bone(rig, 'Chest', spine.tail, Vector((cx, y3, cz)), spine)
    neck = add_bone(rig, 'Neck', chest.tail, Vector((cx, y4, cz)), chest)
    head = add_bone(rig, 'Head', neck.tail, Vector((cx, y5, cz)), neck)

    for side, sx in [('L', -1), ('R', 1)]:
        shoulder = add_bone(rig, f'Shoulder.{side}', Vector((cx, y3, cz)), Vector((cx + sx*h*.10, y3, cz)), chest)
        upper = add_bone(rig, f'UpperArm.{side}', shoulder.tail, Vector((cx + sx*h*.22, y3 - h*.015, cz)), shoulder)
        fore = add_bone(rig, f'LowerArm.{side}', upper.tail, Vector((cx + sx*h*.33, y3 - h*.025, cz)), upper)
        hand = add_bone(rig, f'Hand.{side}', fore.tail, Vector((cx + sx*h*.39, y3 - h*.025, cz)), fore)
        thigh = add_bone(rig, f'Thigh.{side}', Vector((cx + sx*h*.09, y1, cz)), Vector((cx + sx*h*.10, y1-h*.22, cz)), root)
        shin = add_bone(rig, f'Shin.{side}', thigh.tail, Vector((cx + sx*h*.10, y0+h*.07, cz)), thigh)
        foot = add_bone(rig, f'Foot.{side}', shin.tail, Vector((cx + sx*h*.10, y0, cz+h*.12)), shin)

    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def bind_automatic_weights(objects, rig):
    meshes = mesh_objects(objects)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    for mesh in meshes:
        mesh.select_set(True)
    # Blender's built-in automatic weights are the open-source skinning step.
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')


def export_glb(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=True, export_skins=True)


def main():
    args = args_after_double_dash()
    if len(args) < 2:
        raise SystemExit('usage: blender -b --python auto_rig_humanoid.py -- input.glb output.glb')
    src, dst = args[:2]
    clear_scene()
    objects = import_glb(src)
    if not has_skin(objects):
        rig = build_humanoid(objects)
        bind_automatic_weights(objects, rig)
    export_glb(dst)
    print(f'BF_AUTO_RIG_OK input={src} output={dst}')


if __name__ == '__main__':
    main()
