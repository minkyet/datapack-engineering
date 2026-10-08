#> <namespace>:<path/to/loop_function>
# Recurring scheduled tick loop
#
# @context @root
# @internal
# @reads score #stop_requested_<name> <namespace>

## Break check at top
execute if score #stop_requested_<name> <namespace> matches 1 run return run function <namespace>:<path/to/on_loop_end>

## Main recurrent logic
# execute ... run ...

## Reschedule at bottom
schedule function <namespace>:<path/to/loop_function> 1t append
