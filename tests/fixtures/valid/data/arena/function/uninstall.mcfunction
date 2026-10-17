#> arena:uninstall
# 데이터팩 제거 시 모든 스코어보드 및 스토리지를 정리합니다.
#
# @context @root
# @public
# @writes storage arena:shop

scoreboard objectives remove arena.gold
scoreboard objectives remove arena.temp
scoreboard objectives remove arena.const
scoreboard objectives remove arena.display
data remove storage arena:shop
