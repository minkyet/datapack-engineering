#> arena:visual/shop_fx
# 구매 성공 시 사운드, 파티클, 텍스트 피드백을 출력하고 사이드바를 갱신합니다.
#
# @context player (at @s)
# @internal
# @reads score @s arena.gold
# @writes score $line.1 arena.display

scoreboard players operation $line.1 arena.display = @s arena.gold
tellraw @s {text:"검을 구매했습니다!",color:"green"}
playsound minecraft:entity.experience_orb.pickup master @s ~ ~ ~ 1 1
particle minecraft:happy_villager ~ ~1 ~ 0.3 0.3 0.3 0.05 10
