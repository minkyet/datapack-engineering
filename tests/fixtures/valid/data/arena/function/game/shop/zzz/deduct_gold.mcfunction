#> arena:game/shop/zzz/deduct_gold
# 검 가격만큼 플레이어 골드를 차감하는 서브루틴입니다.
#
# @context player
# @private within arena:game/shop/
# @reads score ##price.sword arena.const
# @writes score @s arena.gold

scoreboard players operation @s arena.gold -= ##price.sword arena.const
