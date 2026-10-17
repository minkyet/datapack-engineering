#> arena:game/shop/buy
# 상점에서 검을 구매하는 도메인 로직입니다.
#
# @context player (at @s)
# @internal
# @reads
#   score ##price.sword arena.const
#   score #can.buy arena.temp
#   score @s arena.gold
# @writes score #can.buy arena.temp

scoreboard players set #can.buy arena.temp 0
execute if score @s arena.gold >= ##price.sword arena.const \
    run scoreboard players set #can.buy arena.temp 1
execute if score #can.buy arena.temp matches 1 \
    run function arena:game/shop/zzz/deduct_gold
execute if score #can.buy arena.temp matches 1 \
    run function arena:visual/shop_fx
