let i = 0;
while (true){
	i += 1;
	console.log("Before");
	if (i%2 == 0){
		continue;
	}
	console.log("After");
	if (i==11){
		break;
	}
}