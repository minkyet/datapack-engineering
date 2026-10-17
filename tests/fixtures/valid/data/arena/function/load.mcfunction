#> arena:load
# 데이터팩 로드 시 스코어보드 및 상수를 초기화합니다.
#
# @context @root
# @internal

## 스코어보드 초기화
scoreboard objectives add arena.gold dummy
scoreboard objectives add arena.temp dummy
scoreboard objectives add arena.const dummy
scoreboard objectives add arena.display dummy

## 상수 설정
scoreboard players set ##price.sword arena.const 100
