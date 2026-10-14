# Predicate and Advancement Optimization Patterns

Practical, copy-pasteable JSON patterns for replacing heavy `nbt={...}` entity selector queries and 20Hz `#minecraft:tick` polling.

---

## 1. Replacing NBT Checks with Predicates

Instead of using `nbt={...}` in selectors, save a predicate JSON in `data/<namespace>/predicate/<name>.json` and test it with `if predicate <namespace>:<name>`.

### 1.1 Ground Check Predicate (`data/<namespace>/predicate/is_on_ground.json`)
Replaces `@e[nbt={OnGround:true}]`:

```json
{
  "condition": "minecraft:entity_properties",
  "entity": "this",
  "predicate": {
    "flags": {
      "is_on_ground": true
    }
  }
}
```
**Usage:**
```mcfunction
execute as @e[type=pig,limit=1] if predicate mypack:is_on_ground run ...
```

### 1.2 Sneaking / Crouching Check (`data/<namespace>/predicate/is_sneaking.json`)
Replaces `@a[nbt={Pose:"CROUCHING"}]`:

```json
{
  "condition": "minecraft:entity_properties",
  "entity": "this",
  "predicate": {
    "flags": {
      "is_sneaking": true
    }
  }
}
```
**Usage:**
```mcfunction
execute as @a if predicate mypack:is_sneaking run ...
```

### 1.3 Weather / Dimension Condition (`data/<namespace>/predicate/is_raining.json`)
Replaces manual command/score tracking:

```json
{
  "condition": "minecraft:weather_check",
  "raining": true
}
```

---

## 2. Replacing 20Hz Tick Polling with Advancements

Advancements are evaluated event-driven or throttled to ~1Hz (20-tick intervals), avoiding the performance cost of `#minecraft:tick`.

### 2.1 1-Second Area / Portal Detection (`data/<namespace>/advancement/enter_zone.json`)
Replaces 20Hz `@a[distance=..5]` checks in `tick.mcfunction`. The `minecraft:location` trigger evaluates every 20 ticks (1 second) per player:

```json
{
  "criteria": {
    "in_zone": {
      "trigger": "minecraft:location",
      "conditions": {
        "player": [
          {
            "condition": "minecraft:entity_properties",
            "entity": "this",
            "predicate": {
              "location": {
                "position": {
                  "x": { "min": 10.0, "max": 14.0 },
                  "y": { "min": 64.0, "max": 68.0 },
                  "z": { "min": 20.0, "max": 24.0 }
                }
              }
            }
          }
        ]
      }
    }
  },
  "rewards": {
    "function": "mypack:user/enter_zone"
  }
}
```

**Callback Function (`data/mypack/function/user/enter_zone.mcfunction`):**
```mcfunction
#> mypack:user/enter_zone
# @context player
# @internal
advancement revoke @s only mypack:enter_zone
say Entered zone!
```

### 2.2 Right-Click Interaction Detection (`data/<namespace>/advancement/use_target_item.json`)
Replaces scoreboard polling for carrot-on-a-stick or interactable items:

```json
{
  "criteria": {
    "used_item": {
      "trigger": "minecraft:item_used_on_block",
      "conditions": {
        "location": [
          {
            "condition": "minecraft:match_tool",
            "predicate": {
              "items": "minecraft:stick"
            }
          }
        ]
      }
    }
  },
  "rewards": {
    "function": "mypack:user/on_stick_used"
  }
}
```

---

## 3. Native `if items` Syntax Reference

Modern Minecraft (1.20.5+) provides native item query subcommands that inspect entity inventories without NBT serialization.

### 3.1 Entity Equipment Inspection
```mcfunction
# Check if player is holding a diamond sword in main hand:
execute as @a if items entity @s weapon.mainhand diamond_sword run ...

# Check if entity has netherite chestplate:
execute as @e[type=zombie] if items entity @s armor.chest netherite_chestplate run ...
```

### 3.2 Block Container Inspection
```mcfunction
# Check if chest at origin has redstone:
execute if items block 0 64 0 container.* redstone run ...
```
