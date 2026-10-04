# Example
m = 4

# Known
Row & Column starts at Value 1

# Ans/Solution

```
pint main() {
  pint m= 4;
  for(int i=1; i<= m; i++){
    for(int j=1; j<= m; j++){
      if(j <= i){
        printf("*d");
      }
      else{
        break;
      }
    }
    printf("\n");
  }
  return 0;
}
```

# Observation
1. Right angle triangle
2. Print * only if column Value <= Row Value
To understand level to Row Value

# Assumption
1. Outer loop = Row
2. Inner loop = Column

# TRACE TABLE

| Row | Column | Condition (j<=i) | Output |
|-----|--------|------------------|--------|
| 1 | 1 | 1<=1 | * |
| 1 | 2 | 2<=1 | F |
| 2 | 1 | 1<=2 | * |
| 2 | 2 | 2<=2 | * |
| 2 | 3 | 3<=2 | F |
| 2 | 2 | 2<=2 | * |
| 2 | 3 | 3<=2 | F |
| 3 | 1 | 1<=3 | * |
| 3 | 2 | 2<=3 | * |
| 3 | 3 | 3<=3 | * |
| 3 | 4 | 4<=3 | [obscured] |
| 3 | 2 | 2<=3 | * |
| 3 | 3 | 3<=3 | * |
| > | 3<=2 | * |

Example:
m=4
1
2,2
2,3
2,3,4
4,4,9
