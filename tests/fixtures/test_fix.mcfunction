#> arena:game/test_fix
# 자동 수정 검증용 픽스처 함수입니다.
#
# @context player
# @internal
# @reads
#   score ##price.apple arena.const
#   score @s arena.gold
# @writes score @s arena.gold

execute if score @s arena.gold >= ##price.apple arena.const \
    run scoreboard players operation @s arena.gold -= ##price.apple arena.const
